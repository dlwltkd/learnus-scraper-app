"""
Building a course's knowledge corpus.

Takes the file resources a course sync already discovered and turns each into stored
text: download the original, extract what can be read, and for pages whose content is
visual, render and caption them so that content becomes searchable too.

Three properties this is built around:

* **Originals are kept.** Extraction quality moves; a stored PDF can be reprocessed
  locally forever, while a re-download needs a live LearnUs session that expires.
* **Idempotent.** A file that already has text is skipped, so a re-run costs nothing and
  an interrupted build resumes instead of restarting.
* **Failure is per-file.** One unreadable PDF records its error and the build continues.
"""
import logging
import os
from datetime import datetime

import content_extract as ce

logger = logging.getLogger(__name__)

# Root for downloaded course material. Backed by the `course_files` docker volume — if
# this is not a volume, a container rebuild silently destroys the corpus.
FILES_ROOT = os.getenv('COURSE_FILES_ROOT', '/app/course_files')

# Ceiling on vision calls per file. A build should never be able to run away on a single
# 300-page document, and the daily transcription cap does not apply to captioning.
MAX_CAPTIONS_PER_FILE = 60


def _safe_name(name: str) -> str:
    keep = [c if (c.isalnum() or c in '._- ') else '_' for c in (name or 'file')]
    return ''.join(keep).strip().replace(' ', '_')[:120] or 'file'


def file_dir(course_moodle_id: int, file_moodle_id: int) -> str:
    return os.path.join(FILES_ROOT, str(course_moodle_id), str(file_moodle_id))


def _discard_dir(path: str) -> None:
    import shutil
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception as e:
        logger.warning(f"could not discard {path}: {e}")


def render_page(file_row, course_moodle_id: int, page_no: int) -> str | None:
    """
    Get a PNG of one page, rendering it if it isn't cached yet.

    Page images are treated as a cache rather than stored output: the original PDF is the
    source of truth, and a page regenerates in roughly 0.6-1.8s depending on document
    size. First view pays that, repeat views are served from disk, and the whole cache
    can be deleted at any time to reclaim space without losing anything.

    Returns a path, or None if the file has no stored original to render from.
    """
    if not file_row.local_path or not os.path.exists(file_row.local_path):
        return None
    if (file_row.file_kind or '') != 'pdf':
        return None

    cache_dir = os.path.join(file_dir(course_moodle_id, file_row.moodle_id), 'cache')
    import glob as _glob
    existing = _glob.glob(os.path.join(cache_dir, f"p{page_no:04d}*.png"))
    if existing:
        return existing[0]

    rendered = ce.render_pdf_pages(file_row.local_path, [page_no], cache_dir)
    return rendered.get(page_no)


def warm_pages(local_path: str, file_kind: str, course_moodle_id: int, file_moodle_id: int,
               pages: list[int], page_count: int | None = None) -> None:
    """
    Render neighbouring pages into the cache ahead of being asked for them.

    A cold page costs ~1-2s to rasterise, which is the whole delay when paging through a
    deck. Warming the pages either side turns every subsequent tap into a disk read.
    Takes primitives rather than a model row because it runs after the request's database
    session has closed.
    """
    if not local_path or file_kind != 'pdf' or not os.path.exists(local_path):
        return

    cache_dir = os.path.join(file_dir(course_moodle_id, file_moodle_id), 'cache')
    import glob as _glob

    wanted = []
    for page_no in pages:
        if page_no < 1 or (page_count and page_no > page_count):
            continue
        if _glob.glob(os.path.join(cache_dir, f"p{page_no:04d}*.png")):
            continue
        wanted.append(page_no)

    if not wanted:
        return
    try:
        ce.render_pdf_pages(local_path, wanted, cache_dir)
    except Exception as e:
        # Warming is best-effort; a failure just means the page renders on demand.
        logger.warning(f"page warm failed for {local_path}: {e}")


def build_file(session, file_row, course_moodle_id: int, ai_service=None,
               caption: bool = True, force: bool = False) -> dict:
    """
    Download, extract and (optionally) caption one file resource.

    Mutates `file_row` but does not commit — the caller owns the transaction so a build
    can commit per file and survive interruption.
    """
    report = {'title': file_row.title, 'status': None, 'chars': 0, 'captioned': 0, 'error': None}

    if file_row.content and not force:
        report['status'] = 'skipped'
        report['chars'] = file_row.content_chars or len(file_row.content)
        return report

    # Labels carry their text inline from the course page and have no URL to fetch, so
    # there is nothing for a rebuild to do — including a forced one.
    if not file_row.url:
        report['status'] = 'skipped'
        report['chars'] = file_row.content_chars or len(file_row.content or '')
        return report

    target_dir = file_dir(course_moodle_id, file_row.moodle_id)
    os.makedirs(target_dir, exist_ok=True)

    # --- download -----------------------------------------------------------------
    try:
        response = session.get(file_row.url, timeout=120, allow_redirects=True)
        response.raise_for_status()
        data = response.content
        filename = _safe_name(response.url.split('?')[0].rsplit('/', 1)[-1])
    except Exception as e:
        file_row.extract_status = 'error'
        file_row.extract_error = f"download: {type(e).__name__}: {e}"
        file_row.extracted_at = datetime.now()
        report.update(status='error', error=file_row.extract_error)
        return report

    if len(data) > ce.MAX_FILE_BYTES:
        file_row.extract_status = 'too_large'
        file_row.file_bytes = len(data)
        file_row.extracted_at = datetime.now()
        report['status'] = 'too_large'
        return report

    local_path = os.path.join(target_dir, filename)
    with open(local_path, 'wb') as f:
        f.write(data)

    file_row.local_path = local_path
    file_row.file_bytes = len(data)
    kind = ce.guess_kind(response.url, response.headers.get('Content-Type', ''))
    file_row.file_kind = kind

    # --- extract ------------------------------------------------------------------
    captioned = 0
    try:
        if kind == 'pdf':
            pages = ce.extract_pdf_pages(data)
            file_row.page_count = len(pages)
            captions = {}

            if caption and ai_service is not None:
                targets = ce.sparse_pages(pages)[:MAX_CAPTIONS_PER_FILE]
                if targets:
                    render_dir = os.path.join(target_dir, 'pages')
                    renders = ce.render_pdf_pages(local_path, targets, render_dir)
                    for page_no, image_path in sorted(renders.items()):
                        text, _usage = ai_service.caption_slide(
                            image_path, file_row.title or '', page_no)
                        if text:
                            captions[page_no] = text
                            captioned += 1

                    # Renders were scaffolding for captioning and are ~half the on-disk
                    # footprint. They regenerate from the stored PDF in under two seconds
                    # (see render_page), so keeping them permanently buys nothing.
                    _discard_dir(render_dir)

            content = ce.assemble_pdf_text(pages, captions)
        else:
            content, kind = ce.extract(data, response.url,
                                       response.headers.get('Content-Type', ''))
            file_row.file_kind = kind

    except ce.ExtractionError as e:
        file_row.extract_status = 'error'
        file_row.extract_error = str(e)
        file_row.extracted_at = datetime.now()
        report.update(status='error', error=str(e))
        return report

    if len(content) > ce.MAX_TEXT_CHARS:
        content = content[:ce.MAX_TEXT_CHARS]

    file_row.content = content
    file_row.content_chars = len(content)
    file_row.captioned_pages = captioned
    file_row.extract_error = None
    file_row.extracted_at = datetime.now()
    # An image-only document parses cleanly and yields nothing; that is worth telling
    # apart from success so it can be surfaced rather than silently emptying the corpus.
    file_row.extract_status = 'ok' if content.strip() else 'empty'

    report.update(status=file_row.extract_status, chars=len(content), captioned=captioned)
    return report


def queued_items(db, course) -> set:
    """
    (item_type, item_id) pairs with a manual learn queued or running for this course.

    Read straight off the job queue rather than tracked on the item, so it cannot drift
    out of sync with reality: if the job is gone, the row is no longer "learning".
    """
    from database import Job

    jobs = db.query(Job).filter(
        Job.type == 'brain_learn_item',
        Job.status.in_(('pending', 'processing')),
    ).all()
    return {
        (p.get('item_type'), p.get('item_id'))
        for p in (j.payload or {} for j in jobs)
        if p.get('course_id') == course.id
    }


def corpus_size(db, course) -> dict:
    """
    How much this course has actually learned, for the settings screen.

    Characters rather than bytes: it is what the corpus cap is measured in, so the two
    numbers a curious student might compare are in the same unit.
    """
    from database import Assignment, FileResource, VOD, VodTranscript

    files = db.query(FileResource).filter_by(course_id=course.id).all()
    file_chars = sum(f.content_chars or len(f.content or '') for f in files)
    learned_files = sum(1 for f in files if f.content)
    captioned = sum(f.captioned_pages or 0 for f in files)

    vods = db.query(VOD).filter_by(course_id=course.id).all()
    vod_chars, learned_vods = 0, 0
    for vod in vods:
        row = db.query(VodTranscript).filter_by(moodle_id=vod.moodle_id).first()
        if row and row.transcript:
            vod_chars += len(row.transcript)
            learned_vods += 1

    assignments = db.query(Assignment).filter_by(course_id=course.id).all()
    learned_assignments = sum(1 for a in assignments if a.description)

    return {
        'chars': file_chars + vod_chars,
        'files': learned_files, 'total_files': len(files),
        'vods': learned_vods, 'total_vods': len(vods),
        'assignments': learned_assignments, 'total_assignments': len(assignments),
        'captioned_pages': captioned,
    }


def build_library(db, course) -> dict:
    """
    The course as a navigable structure, grouped by the week each item sits under.

    Costs nothing to derive: every artifact already carries `section` and `week` from the
    course-page scrape, so the tree is a grouping rather than a computation, and it lands
    in the same order the course page uses — the student's existing mental model.

    Items missing from the corpus are still listed, marked with why. A library that
    silently omits an untranscribed lecture teaches the student not to trust it.
    """
    from database import Assignment, VOD, VodTranscript, FileResource, Board, Post

    files = db.query(FileResource).filter_by(course_id=course.id).all()
    vods = db.query(VOD).filter_by(course_id=course.id).all()
    assignments = db.query(Assignment).filter_by(course_id=course.id).all()
    boards = db.query(Board).filter_by(course_id=course.id).all()

    transcripts = {
        t.moodle_id: t
        for t in db.query(VodTranscript).filter(
            VodTranscript.moodle_id.in_([v.moodle_id for v in vods] or [0])
        ).all()
    }
    post_counts, post_chars = {}, {}
    for board in boards:
        rows = db.query(Post).filter_by(board_id=board.id).all()
        post_counts[board.id] = len(rows)
        post_chars[board.id] = sum(len(p.content or '') for p in rows)

    # Items with a manual learn already queued, so the row can say so instead of
    # inviting a second tap that would queue the same work twice. One query for the
    # whole tree rather than a lookup per row.
    learning = queued_items(db, course)

    buckets = {}

    def add(section, week, item):
        key = section if section is not None else 9999
        bucket = buckets.setdefault(key, {'section': section, 'week': week or '기타', 'items': []})
        if week and bucket['week'] == '기타':
            bucket['week'] = week
        bucket['items'].append(item)

    for f in files:
        add(f.section, f.week, {
            'type': 'label' if f.file_kind == 'label' else 'file',
            'id': f.id, 'moodle_id': f.moodle_id, 'title': f.title,
            'kind': f.file_kind, 'pages': f.page_count,
            'chars': f.content_chars or 0,
            'captioned_pages': f.captioned_pages or 0,
            'in_corpus': bool(f.content),
            'learning': ('file', f.id) in learning,
            'status': f.extract_status,
            'url': f.url,
        })

    for v in vods:
        t = transcripts.get(v.moodle_id)
        add(v.section, v.week, {
            'type': 'vod',
            'id': v.id, 'moodle_id': v.moodle_id, 'title': v.title,
            'duration': v.duration, 'completed': bool(v.is_completed),
            'in_corpus': bool(t and t.transcript),
            'learning': ('vod', v.id) in learning,
            'status': (t.status if t else None) or 'not_transcribed',
            'chars': len(t.transcript) if (t and t.transcript) else 0,
            'url': v.url,
        })

    for a in assignments:
        add(a.section, a.week, {
            'type': 'assignment',
            'id': a.id, 'moodle_id': a.moodle_id, 'title': a.title,
            'due_date': a.due_date, 'completed': bool(a.is_completed),
            'in_corpus': bool(a.description),
            'learning': ('assignment', a.id) in learning,
            'chars': len(a.description or ''),
            'url': a.url,
        })

    for b in boards:
        add(b.section, b.week, {
            'type': 'board',
            'id': b.id, 'moodle_id': b.moodle_id, 'title': b.title,
            'posts': post_counts.get(b.id, 0),
            'chars': post_chars.get(b.id, 0),
            'in_corpus': post_counts.get(b.id, 0) > 0,
            'url': b.url,
        })

    # Course Summary (section 0) first, then weeks in course order, undated last.
    sections = [buckets[k] for k in sorted(buckets)]
    for s in sections:
        s['count'] = len(s['items'])
        s['items'].sort(key=lambda i: (
            {'file': 0, 'label': 1, 'vod': 2, 'assignment': 3, 'board': 4}.get(i['type'], 9),
            (i.get('title') or ''),
        ))

    total_chars = sum(i.get('chars', 0) for s in sections for i in s['items'])
    return {
        'course': {'id': course.id, 'moodle_id': course.moodle_id, 'name': course.name},
        'stats': {
            'files': len(files), 'vods': len(vods), 'assignments': len(assignments),
            'boards': len(boards), 'posts': sum(post_counts.values()),
            'corpus_chars': total_chars,
            'in_corpus': sum(1 for s in sections for i in s['items'] if i['in_corpus']),
            'total_items': sum(len(s['items']) for s in sections),
        },
        'sections': sections,
    }


# Ceiling on the assembled course document.
#
# The first value here (400K chars) was set when a course was slides only, and adding
# lecture transcripts pushed straight past it — a course silently lost its later weeks,
# and the model correctly reported it had no numpy script because the assembly had cut it.
#
# The real constraint is the model: gpt-5.6-luna takes 1.05M tokens, and its long-context
# surcharge starts above 272K. Korean tokenizes far denser than English (closer to 1-1.5
# chars per token versus ~4), so a mixed-language corpus cannot be sized by characters
# alone — this cap is deliberately set to stay clear of that threshold even if a course
# were entirely Korean.
MAX_CORPUS_CHARS = 900_000

# Per-item ceiling, so one enormous transcript cannot crowd out an entire course.
MAX_ITEM_CHARS = 60_000

_TYPE_LABEL = {
    'file': '강의자료',
    'label': '안내',
    'vod': '강의 스크립트',
    'assignment': '과제',
    'board': '게시판',
}


def assemble_corpus(db, course) -> tuple[str, list[dict]]:
    """
    The whole course as one document, plus the source list its citations refer to.

    Ordered by week and rendered as markdown so the structure the student sees in the
    library is the structure the model reads. Every item is introduced by a stable `[S<n>]`
    marker; the model is told to cite those, and the returned source list maps each back to
    a real row so the app can turn a citation into a tappable destination.

    Assembly is deterministic — same corpus, same bytes — which is what lets the provider's
    prompt cache treat it as a repeated prefix across every question about this course.
    """
    from database import Assignment, VOD, VodTranscript, FileResource, Board, Post

    files = db.query(FileResource).filter_by(course_id=course.id).all()
    vods = db.query(VOD).filter_by(course_id=course.id).all()
    assignments = db.query(Assignment).filter_by(course_id=course.id).all()
    boards = db.query(Board).filter_by(course_id=course.id).all()
    transcripts = {
        t.moodle_id: t for t in db.query(VodTranscript).filter(
            VodTranscript.moodle_id.in_([v.moodle_id for v in vods] or [0])
        ).all()
    }

    buckets: dict[int, list[dict]] = {}

    def add(section, week, entry):
        buckets.setdefault(
            section if section is not None else 9999,
            {'week': week or '기타', 'items': []},
        )
        bucket = buckets[section if section is not None else 9999]
        if week and bucket['week'] == '기타':
            bucket['week'] = week
        bucket['items'].append(entry)

    for f in files:
        if not f.content:
            continue
        add(f.section, f.week, {
            'type': 'label' if f.file_kind == 'label' else 'file',
            'id': f.id, 'title': f.title, 'body': f.content, 'week': f.week,
        })

    for v in vods:
        t = transcripts.get(v.moodle_id)
        if not (t and t.transcript):
            continue
        add(v.section, v.week, {
            'type': 'vod', 'id': v.id, 'title': v.title, 'body': t.transcript, 'week': v.week,
        })

    for a in assignments:
        parts = []
        if a.due_date:
            parts.append(f"마감: {a.due_date}")
        if a.description:
            parts.append(a.description)
        if not parts:
            continue
        add(a.section, a.week, {
            'type': 'assignment', 'id': a.id, 'title': a.title,
            'body': "\n".join(parts), 'week': a.week,
        })

    for b in boards:
        posts = db.query(Post).filter_by(board_id=b.id).all()
        rendered = []
        for p in posts:
            text = ce.html_to_text(p.content)
            if not text:
                continue
            head = " · ".join(x for x in (p.title, p.writer, p.date) if x)
            rendered.append(f"[{head}]\n{text}")
        if not rendered:
            continue
        add(b.section, b.week, {
            'type': 'board', 'id': b.id, 'title': b.title,
            'body': "\n\n".join(rendered), 'week': b.week,
        })

    lines = [f"# {course.name}", ""]
    sources: list[dict] = []
    total = len(lines[0])
    ref_no = 0

    for key in sorted(buckets):
        bucket = buckets[key]
        if not bucket['items']:
            continue
        header = f"## {bucket['week']}"
        lines.append(header)
        lines.append("")
        total += len(header)

        for item in bucket['items']:
            body = (item['body'] or '').strip()
            if len(body) > MAX_ITEM_CHARS:
                body = body[:MAX_ITEM_CHARS] + "\n…(이하 생략)"
            if total + len(body) > MAX_CORPUS_CHARS:
                lines.append("(길이 제한으로 이후 자료는 생략되었습니다.)")
                return "\n".join(lines), sources

            ref_no += 1
            ref = f"S{ref_no}"
            sources.append({
                'ref': ref, 'type': item['type'], 'id': item['id'],
                'title': item['title'], 'week': item['week'],
            })
            lines.append(f"### [{ref}] {_TYPE_LABEL.get(item['type'], item['type'])}: {item['title']}")
            lines.append(body)
            lines.append("")
            total += len(body)

    return "\n".join(lines), sources


def get_item_detail(db, course, item_type: str, item_id: int) -> dict | None:
    """
    The actual content behind one library row.

    Kept out of the library listing on purpose — bodies are large and the tree is meant to
    stay cheap — but a row that opens to nothing but its own title is useless, so every
    type resolves to something readable here.
    """
    from database import Assignment, VOD, VodTranscript, FileResource, Board, Post

    if item_type in ('file', 'label'):
        row = db.query(FileResource).filter_by(id=item_id, course_id=course.id).first()
        if not row:
            return None
        return {
            'type': item_type, 'id': row.id, 'title': row.title, 'week': row.week,
            'kind': row.file_kind, 'pages': row.page_count,
            'captioned_pages': row.captioned_pages or 0,
            'content': row.content, 'chars': row.content_chars or 0,
            'status': row.extract_status, 'error': row.extract_error, 'url': row.url,
        }

    if item_type == 'assignment':
        row = db.query(Assignment).filter_by(id=item_id, course_id=course.id).first()
        if not row:
            return None
        return {
            'type': 'assignment', 'id': row.id, 'title': row.title, 'week': row.week,
            'due_date': row.due_date, 'completed': bool(row.is_completed),
            'content': row.description, 'chars': len(row.description or ''),
            'url': row.url,
        }

    if item_type == 'vod':
        row = db.query(VOD).filter_by(id=item_id, course_id=course.id).first()
        if not row:
            return None
        transcript = db.query(VodTranscript).filter_by(moodle_id=row.moodle_id).first()
        return {
            'type': 'vod', 'id': row.id, 'title': row.title, 'week': row.week,
            'duration': row.duration, 'completed': bool(row.is_completed),
            'summary': transcript.summary if transcript else None,
            'content': transcript.transcript if transcript else None,
            'chars': len(transcript.transcript) if (transcript and transcript.transcript) else 0,
            'status': (transcript.status if transcript else None) or 'not_transcribed',
            'url': row.url, 'moodle_id': row.moodle_id,
        }

    if item_type == 'board':
        row = db.query(Board).filter_by(id=item_id, course_id=course.id).first()
        if not row:
            return None
        posts = db.query(Post).filter_by(board_id=row.id).all()
        return {
            'type': 'board', 'id': row.id, 'title': row.title, 'week': row.week,
            'url': row.url,
            # Posts are stored as HTML for the WebView-based detail screen; flatten it
            # here so it reads as text and does not spend corpus tokens on markup.
            'posts': [
                {'id': p.id, 'title': p.title, 'writer': p.writer, 'date': p.date,
                 'content': ce.html_to_text(p.content), 'url': p.url}
                for p in posts
            ],
            'chars': sum(len(ce.html_to_text(p.content)) for p in posts),
        }

    return None


def fetch_assignment_descriptions(client, db, course, force: bool = False) -> dict:
    """
    Fill in assignment instructions, one request per assignment.

    Deliberately part of the brain build rather than the regular sync: sync runs on a
    schedule for every course, and adding a page fetch per assignment there would slow a
    frequent path to populate a field only the brain reads. Skips anything already
    fetched, so the cost is one-time.
    """
    from database import Assignment

    rows = db.query(Assignment).filter_by(course_id=course.id).all()
    summary = {'total': len(rows), 'fetched': 0, 'skipped': 0, 'empty': 0}

    for row in rows:
        if row.description and not force:
            summary['skipped'] += 1
            continue
        if not row.url:
            summary['empty'] += 1
            continue

        detail = client.get_assignment_detail(row.url)
        row.description = detail.get('description')
        row.description_fetched_at = datetime.now()
        db.commit()

        if row.description:
            summary['fetched'] += 1
        else:
            summary['empty'] += 1

    return summary


def build_course_files(session, db, course, ai_service=None, caption: bool = True,
                       force: bool = False, on_progress=None) -> dict:
    """
    Build every file resource in a course. Commits after each file so an interrupted
    run keeps its work.
    """
    from database import FileResource

    files = db.query(FileResource).filter_by(course_id=course.id).all()
    summary = {'total': len(files), 'ok': 0, 'skipped': 0, 'empty': 0,
               'error': 0, 'too_large': 0, 'chars': 0, 'captioned': 0}

    for index, row in enumerate(files, start=1):
        report = build_file(session, row, course.moodle_id, ai_service=ai_service,
                            caption=caption, force=force)
        db.commit()

        key = report['status'] if report['status'] in summary else 'error'
        summary[key] += 1
        summary['chars'] += report['chars']
        summary['captioned'] += report['captioned']

        logger.info(
            f"brain build course={course.moodle_id} [{index}/{len(files)}] "
            f"{report['status']} chars={report['chars']} cap={report['captioned']} "
            f"{(row.title or '')[:50]}"
        )
        if on_progress:
            on_progress(index, len(files), report)

    return summary


# ─── Whole-course build ───────────────────────────────────────────────────────
#
# Enabling the brain on a course runs one full sweep; every later sync tops it up.
# Both directions go through build_course_brain — the only difference is how much is
# already done, and every step below is individually idempotent, so "full" and
# "incremental" are the same code path with different amounts of work to do.


# What a course can learn. Boards are absent on purpose: their posts arrive with the
# regular sync and are in the corpus whether or not a build ever runs.
SCOPE_KEYS = ('vods', 'files', 'assignments')


def scope_of(course) -> dict:
    """
    Which material this course learns, defaulting to everything.

    Defaults matter here: a course enabled before this setting existed has no stored
    scope, and the safe reading is the behaviour it already had — learn all of it.
    """
    stored = getattr(course, 'brain_scope', None) or {}
    return {key: bool(stored.get(key, True)) for key in SCOPE_KEYS}


def pending_work(db, course) -> dict:
    """
    What the brain has not learned yet for this course.

    Cheap enough to call on every sync: three counts, no network. Used to decide whether
    a top-up job is worth enqueueing at all, so an unchanged course costs nothing.
    """
    from database import Assignment, FileResource, VOD, VodTranscript

    scope = scope_of(course)

    files = db.query(FileResource).filter(
        FileResource.course_id == course.id,
        FileResource.extract_status.is_(None),
    ).count() if scope['files'] else 0

    assignments = db.query(Assignment).filter(
        Assignment.course_id == course.id,
        Assignment.description.is_(None),
        Assignment.url.isnot(None),
    ).count() if scope['assignments'] else 0

    # A VOD needs work when it has no transcript row, or one that never completed.
    vods = 0
    if scope['vods']:
        for vod in db.query(VOD).filter_by(course_id=course.id).all():
            row = db.query(VodTranscript).filter_by(moodle_id=vod.moodle_id).first()
            if not row or not row.transcript or row.status != 'done':
                vods += 1

    return {'files': files, 'vods': vods, 'assignments': assignments,
            'total': files + vods + assignments}


class _Skipped(Exception):
    """A stage the course's scope excludes. Not an error, so it is caught separately."""


def build_course_brain(client, db, course, ai_service, *, transcribe: bool = True,
                       force: bool = False, on_stage=None, can_transcribe=None) -> dict:
    """
    Bring a course's corpus up to date: assignment instructions, lecture transcripts,
    then file text and captions.

    `on_stage(stage, done, total)` reports coarse progress for the UI. Every stage
    commits as it goes, so a deploy that restarts the container mid-build loses only the
    item in flight — the next run resumes from there rather than starting over.

    `can_transcribe()` is asked before each lecture and gates spend. Returning False
    stops the transcription stage cleanly rather than failing the build: what is already
    done is kept, and the next run picks up where the budget ran out.

    Failure is per-item throughout. A lecture whose stream URL has expired records the
    error and the build moves on; one bad item must not cost the whole sweep.
    """
    from database import VOD, VodTranscript

    scope = scope_of(course)
    summary = {'assignments': {}, 'vods': {'total': 0, 'ok': 0, 'skipped': 0, 'failed': 0, 'deferred': 0},
               'files': {}, 'errors': [], 'scope': scope}

    def stage(name, done, total):
        if on_stage:
            on_stage(name, done, total)

    # 1. Assignment instructions. Cheap, and the answers lean on them heavily.
    stage('assignments', 0, 1)
    try:
        if not scope['assignments']:
            raise _Skipped()
        summary['assignments'] = fetch_assignment_descriptions(client, db, course, force=force)
    except _Skipped:
        summary['assignments'] = {'skipped_by_scope': True}
    except Exception as e:
        logger.exception("brain build: assignment descriptions failed")
        summary['errors'].append(f"assignments: {type(e).__name__}: {e}")
    stage('assignments', 1, 1)

    # 2. Lecture transcripts. The expensive stage, and the one most worth resuming:
    #    each finished lecture is committed before the next begins.
    if transcribe and scope['vods']:
        vods = db.query(VOD).filter_by(course_id=course.id).all()
        summary['vods']['total'] = len(vods)
        for index, vod in enumerate(vods, start=1):
            stage('vods', index - 1, len(vods))
            row = db.query(VodTranscript).filter_by(moodle_id=vod.moodle_id).first()
            done_already = row and row.transcript and row.status == 'done'
            # Transcripts predating chunk timestamps have no leading marker, so they are
            # redone once to make the chat's [[vod:...]] seek links land correctly.
            timestamped = done_already and row.transcript.lstrip().startswith('[')
            if done_already and timestamped and not force:
                summary['vods']['skipped'] += 1
                continue
            if can_transcribe is not None and not can_transcribe():
                # Budget spent. Everything transcribed so far is committed, and the
                # remaining lectures are simply still pending for the next run.
                summary['vods']['deferred'] = len(vods) - index + 1
                logger.info(
                    f"brain build course={course.moodle_id}: transcription budget spent, "
                    f"deferring {summary['vods']['deferred']} lectures"
                )
                break
            try:
                stream = client.get_vod_stream_url(vod.moodle_id, vod.url)
                m3u8 = stream if isinstance(stream, str) else (stream or {}).get('m3u8_url')
                if not m3u8:
                    summary['vods']['failed'] += 1
                    summary['errors'].append(f"vod {vod.moodle_id}: no stream url")
                    continue
                transcript, _usage = ai_service.transcribe_vod(m3u8)
                if not row:
                    row = VodTranscript(moodle_id=vod.moodle_id)
                    db.add(row)
                row.transcript = transcript
                row.status = 'done'
                row.stage = 'completed'
                row.is_processing = False
                row.progress_pct = 100
                row.completed_at = datetime.now()
                db.commit()
                summary['vods']['ok'] += 1
            except Exception as e:
                db.rollback()
                summary['vods']['failed'] += 1
                summary['errors'].append(f"vod {vod.moodle_id}: {type(e).__name__}: {e}")
                logger.exception(f"brain build: vod {vod.moodle_id} failed")
        stage('vods', len(vods), len(vods))

    # 3. File text and slide captions.
    def file_progress(index, total, _report):
        stage('files', index, total)

    try:
        if not scope['files']:
            raise _Skipped()
        summary['files'] = build_course_files(
            client.session, db, course, ai_service=ai_service,
            caption=True, force=force, on_progress=file_progress,
        )
    except _Skipped:
        summary['files'] = {'skipped_by_scope': True}
    except Exception as e:
        logger.exception("brain build: file build failed")
        summary['errors'].append(f"files: {type(e).__name__}: {e}")

    return summary


def enqueue_brain_build(db, course, *, full: bool = False) -> bool:
    """
    Queue a build for this course unless one is already waiting or running.

    Returns True if a job was created. The duplicate check matters because syncs are
    frequent: without it, an hourly sync of a course whose build is still running would
    pile up jobs that each redo the same work.
    """
    from database import Job

    existing = db.query(Job).filter(
        Job.type == 'brain_build',
        Job.status.in_(('pending', 'processing')),
    ).all()
    if any((j.payload or {}).get('course_id') == course.id for j in existing):
        return False

    db.add(Job(type='brain_build', payload={
        'course_id': course.id,
        'user_id': course.owner_id,
        'full': full,
    }))
    course.brain_status = 'queued'
    course.brain_stage = '대기 중'
    if full:
        course.brain_progress = 0
    db.commit()
    logger.info(f"brain build queued course={course.moodle_id} full={full}")
    return True


def build_single_item(client, db, course, ai_service, item_type: str, item_id: int) -> dict:
    """
    Learn one item on demand.

    The counterpart to the sweep: when a course is not worth building in full, or a
    single file was skipped, this teaches exactly one thing. Same primitives as the
    sweep, so an item learned here is indistinguishable from one learned by a build.
    """
    from database import Assignment, FileResource, VOD, VodTranscript

    if item_type == 'file':
        row = db.query(FileResource).filter_by(id=item_id, course_id=course.id).first()
        if not row:
            raise ValueError(f"File {item_id} not in course {course.id}")
        report = build_file(client.session, row, course.moodle_id,
                            ai_service=ai_service, caption=True, force=False)
        db.commit()
        return report

    if item_type == 'vod':
        vod = db.query(VOD).filter_by(id=item_id, course_id=course.id).first()
        if not vod:
            raise ValueError(f"VOD {item_id} not in course {course.id}")
        stream = client.get_vod_stream_url(vod.moodle_id, vod.url)
        m3u8 = stream if isinstance(stream, str) else (stream or {}).get('m3u8_url')
        if not m3u8:
            raise ValueError("No stream URL for this lecture")
        transcript, _usage = ai_service.transcribe_vod(m3u8)
        row = db.query(VodTranscript).filter_by(moodle_id=vod.moodle_id).first()
        if not row:
            row = VodTranscript(moodle_id=vod.moodle_id)
            db.add(row)
        row.transcript = transcript
        row.status = 'done'
        row.stage = 'completed'
        row.is_processing = False
        row.progress_pct = 100
        row.completed_at = datetime.now()
        db.commit()
        return {'status': 'ok', 'chars': len(transcript), 'captioned': 0}

    if item_type == 'assignment':
        row = db.query(Assignment).filter_by(id=item_id, course_id=course.id).first()
        if not row or not row.url:
            raise ValueError(f"Assignment {item_id} not in course {course.id}")
        detail = client.get_assignment_detail(row.url)
        row.description = detail.get('description')
        row.description_fetched_at = datetime.now()
        db.commit()
        return {'status': 'ok', 'chars': len(row.description or ''), 'captioned': 0}

    raise ValueError(f"Cannot learn item type {item_type!r}")


def enqueue_item_learn(db, course, item_type: str, item_id: int) -> bool:
    """Queue one item unless the same item is already waiting or running."""
    from database import Job

    if (item_type, item_id) in queued_items(db, course):
        return False
    db.add(Job(type='brain_learn_item', payload={
        'course_id': course.id,
        'user_id': course.owner_id,
        'item_type': item_type,
        'item_id': item_id,
    }))
    db.commit()
    logger.info(f"brain learn queued course={course.moodle_id} {item_type}:{item_id}")
    return True
