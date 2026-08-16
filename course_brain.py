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
