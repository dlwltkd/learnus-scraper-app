"""
Text extraction for course file resources.

A `ubfile` URL redirects straight to the underlying file, so fetching course material is
a single authenticated GET. What comes back is one of a small number of shapes, and this
module turns each into plain text that a model can read.

Observed across a real course (CAS2105): 23 PDFs and 5 Jupyter notebooks. Notebooks are
just JSON, so they need no dependency — only PDFs pull in `pypdf`.

Nothing here writes to the database; callers decide what to persist.
"""
import io
import json
import logging
import re

logger = logging.getLogger(__name__)

# Lecture decks run large — one slide deck in the sample course is 31MB. The cap exists
# to stop a pathological file from exhausting memory on a small droplet, not to be tight.
MAX_FILE_BYTES = 80 * 1024 * 1024

# Beyond this we keep the head of the document rather than the whole thing. Slide decks
# occasionally embed enormous extracted-text blobs; the corpus budget matters more than
# completeness on outliers.
MAX_TEXT_CHARS = 400_000


class ExtractionError(Exception):
    pass


def _clean(text: str) -> str:
    """Collapse the whitespace noise that PDF extraction leaves behind."""
    text = text.replace('\x00', '')
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


# A page yielding less than this much text is carrying its content visually — a title
# plus a diagram. Measured on a real course (CAS2105): 244 of 886 pages, 27%, and no
# page was ever fully empty. This threshold is what keeps the vision pass off the 73%
# of pages that text extraction already reads perfectly well.
SPARSE_PAGE_CHARS = 100


def extract_pdf_pages(data: bytes) -> list[str]:
    """Per-page text, index 0 = page 1. Empty string where a page yields nothing."""
    try:
        from pypdf import PdfReader
    except ImportError as e:
        raise ExtractionError("pypdf is not installed") from e

    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as e:
        raise ExtractionError(f"unreadable pdf: {e}") from e

    if getattr(reader, 'is_encrypted', False):
        try:
            reader.decrypt('')
        except Exception as e:
            raise ExtractionError("encrypted pdf") from e

    pages = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            pages.append((page.extract_text() or '').strip())
        except Exception as e:
            logger.warning(f"pdf page {i} failed to extract: {e}")
            pages.append('')
    return pages


def sparse_pages(pages: list[str], threshold: int = SPARSE_PAGE_CHARS) -> list[int]:
    """1-based page numbers whose content is visual rather than textual."""
    return [i for i, text in enumerate(pages, start=1) if len(text) < threshold]


def render_pdf_pages(pdf_path: str, page_numbers: list[int], out_dir: str,
                     dpi: int = 110) -> dict[int, str]:
    """
    Rasterise selected pages with poppler's pdftoppm. Returns {page_number: png_path}.

    Only the pages identified as sparse are rendered — rendering all 886 pages of a
    course would cost minutes of build time to produce images for slides whose text we
    already have. 110 DPI is enough for a model to read a diagram without producing
    multi-megabyte PNGs.
    """
    import os
    import subprocess

    os.makedirs(out_dir, exist_ok=True)
    rendered = {}

    for page_no in page_numbers:
        prefix = os.path.join(out_dir, f"p{page_no:04d}")
        try:
            subprocess.run(
                ["pdftoppm", "-png", "-r", str(dpi),
                 "-f", str(page_no), "-l", str(page_no),
                 pdf_path, prefix],
                check=True, capture_output=True, timeout=120,
            )
        except FileNotFoundError:
            raise ExtractionError("pdftoppm not found (install poppler-utils)")
        except subprocess.CalledProcessError as e:
            logger.warning(f"render failed p{page_no}: {e.stderr[:200]!r}")
            continue
        except subprocess.TimeoutExpired:
            logger.warning(f"render timed out p{page_no}")
            continue

        # pdftoppm appends its own zero-padded page suffix, whose width varies with the
        # document's page count, so glob rather than guessing the filename.
        import glob as _glob
        matches = _glob.glob(prefix + "*.png")
        if matches:
            rendered[page_no] = matches[0]

    return rendered


def extract_pdf(data: bytes) -> str:
    """
    Whole-document text with [p.N] markers, built from the per-page extraction.

    The markers are load-bearing: a caption generated later for a visually dense page
    slots in beside that page's text, so the assembled document stays in reading order.
    """
    return assemble_pdf_text(extract_pdf_pages(data))


def assemble_pdf_text(pages: list[str], captions: dict[int, str] | None = None) -> str:
    """
    Join per-page text into one document, folding in vision captions where present.

    A caption is marked so the model can tell described-image from transcribed-text, and
    so a wrong caption is traceable back to a page rather than blending invisibly into
    the lecture's own words.
    """
    captions = captions or {}
    parts = []
    for i, page_text in enumerate(pages, start=1):
        caption = (captions.get(i) or '').strip()
        page_text = (page_text or '').strip()
        if not page_text and not caption:
            continue
        block = [f"[p.{i}]"]
        if page_text:
            block.append(page_text)
        if caption:
            block.append(f"[image] {caption}")
        parts.append("\n".join(block))
    return _clean("\n\n".join(parts))


def extract_ipynb(data: bytes) -> str:
    """
    Markdown cells as prose, code cells fenced.

    Outputs are skipped: they are mostly rendered images and repeated stack traces, and
    they bloat the corpus far more than they inform it.
    """
    try:
        nb = json.loads(data.decode('utf-8', errors='replace'))
    except Exception as e:
        raise ExtractionError(f"unreadable notebook: {e}") from e

    language = (
        nb.get('metadata', {}).get('language_info', {}).get('name')
        or nb.get('metadata', {}).get('kernelspec', {}).get('language')
        or 'python'
    )

    parts = []
    for cell in nb.get('cells', []):
        source = cell.get('source', '')
        if isinstance(source, list):
            source = ''.join(source)
        source = source.strip()
        if not source:
            continue

        kind = cell.get('cell_type')
        if kind == 'markdown':
            parts.append(source)
        elif kind == 'code':
            parts.append(f"```{language}\n{source}\n```")

    return _clean("\n\n".join(parts))


def html_to_text(raw: str | None) -> str:
    """
    Flatten stored HTML into readable text.

    Board posts are kept as HTML because the post detail screen renders them in a WebView,
    but everywhere else the markup is noise: it renders literally in a plain <Text>, and
    it burns corpus tokens on `<p></p>` that carry no meaning for a model.
    """
    if not raw:
        return ''

    import html as html_lib

    text = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', raw)

    # Keep the destination of a link. Stripping tags outright threw the href away, so an
    # announcement saying "submit here" lost the only thing that mattered. The URL is
    # appended only when the visible text does not already contain it, to avoid
    # "https://x (https://x)" for links that were pasted as their own address.
    def _keep_href(match):
        href = html_lib.unescape(match.group(1)).strip()
        label = re.sub(r'<[^>]+>', '', match.group(2)).strip()
        label = html_lib.unescape(label)
        if not href or href.startswith(('#', 'javascript:')):
            return label
        if not label:
            return href
        if href in label or label in href:
            return label
        return f"{label} ({href})"

    text = re.sub(r'(?is)<a[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', _keep_href, text)

    text = re.sub(r'(?i)<br\s*/?>', '\n', text)
    text = re.sub(r'(?i)</(p|div|li|tr|h[1-6])>', '\n', text)
    text = re.sub(r'(?i)<li[^>]*>', '• ', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = html_lib.unescape(text)
    text = text.replace('\xa0', ' ')
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r' *\n *', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def extract_plain(data: bytes) -> str:
    return _clean(data.decode('utf-8', errors='replace'))


# Dispatch is by extension first (the redirect target carries a real filename) and falls
# back to content sniffing, because Moodle serves notebooks as application/unknown.
_BY_EXTENSION = {
    'pdf': extract_pdf,
    'ipynb': extract_ipynb,
    'txt': extract_plain,
    'md': extract_plain,
    'csv': extract_plain,
    'py': extract_plain,
}


def guess_kind(url: str, content_type: str = '') -> str:
    filename = (url or '').split('?')[0].rsplit('/', 1)[-1]
    if '.' in filename:
        ext = filename.rsplit('.', 1)[-1].lower()
        if ext in _BY_EXTENSION:
            return ext
    if 'pdf' in (content_type or '').lower():
        return 'pdf'
    return 'unknown'


def extract(data: bytes, url: str, content_type: str = '') -> tuple[str, str]:
    """
    Return (text, kind). Raises ExtractionError for formats we can read but that turn
    out to be malformed; returns empty text for formats we simply do not support.
    """
    kind = guess_kind(url, content_type)
    handler = _BY_EXTENSION.get(kind)
    if not handler:
        return '', kind

    text = handler(data)
    if len(text) > MAX_TEXT_CHARS:
        logger.info(f"truncating extracted text {len(text)} -> {MAX_TEXT_CHARS} for {url[:80]}")
        text = text[:MAX_TEXT_CHARS]
    return text, kind


def fetch_and_extract(session, url: str, timeout: int = 60) -> dict:
    """
    Download a course file and extract its text.

    Returns a result dict rather than raising, so a single bad file cannot abort a whole
    course build. `status` is one of: ok | empty | unsupported | too_large | error.
    """
    result = {'status': 'error', 'text': '', 'kind': 'unknown', 'bytes': 0, 'error': None,
              'filename': None}
    try:
        response = session.get(url, timeout=timeout, allow_redirects=True)
        response.raise_for_status()

        data = response.content
        result['bytes'] = len(data)
        result['filename'] = response.url.split('?')[0].rsplit('/', 1)[-1]

        if len(data) > MAX_FILE_BYTES:
            result['status'] = 'too_large'
            result['error'] = f"{len(data)} bytes exceeds cap"
            return result

        text, kind = extract(data, response.url, response.headers.get('Content-Type', ''))
        result['kind'] = kind

        if not _BY_EXTENSION.get(kind):
            result['status'] = 'unsupported'
            return result

        result['text'] = text
        # An image-only PDF parses fine and yields nothing. That is a real outcome worth
        # distinguishing from success, so it can be surfaced instead of silently
        # contributing an empty document to the corpus.
        result['status'] = 'ok' if text.strip() else 'empty'
        return result

    except ExtractionError as e:
        result['error'] = str(e)
        return result
    except Exception as e:
        result['error'] = f"{type(e).__name__}: {e}"
        return result
