"""Document parser — trích xuất text + smart chunking 3 cấp + fallback."""

import io
import re
import importlib
from typing import List, Dict, Any

from ..config import MIN_CHUNK_CHARS, MAX_CHUNK_CHARS, MAX_CHUNKS_PER_DOC

ARTICLE_PATTERN = re.compile(
    r"(?im)^\s*((?:Điều|ĐIỀU|Article|Clause)\s+(\d+)\s*[:\.\-–]?\s*([^\n]*))\s*$"
)

SECTION_PATTERN = re.compile(
    r"(?im)^\s*((?:Chương|CHƯƠNG|Mục|MỤC|Phần|PHẦN|Chapter|Section)\s+([\dIVXivx]+)\s*[:\.\-–]?\s*([^\n]*))\s*$"
)

NUMBERED_HEADING_PATTERN = re.compile(
    r"(?m)^\s*((?:\d+\.(?:\d+\.)*|[a-z]\))\s+[^\n]{5,})\s*$"
)


def extract_text_from_file(filename: str, file_bytes: bytes) -> str:
    """Trích xuất text từ DOCX hoặc PDF."""
    suffix = filename.lower().rsplit(".", 1)[-1]

    if suffix == "docx":
        Document = importlib.import_module("docx").Document
        doc = Document(io.BytesIO(file_bytes))
        return "\n".join(p.text.strip() for p in doc.paragraphs if p.text and p.text.strip())

    if suffix == "pdf":
        PdfReader = importlib.import_module("pypdf").PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
        return "\n".join(p for p in pages if p)

    raise ValueError("Định dạng chưa hỗ trợ. Vui lòng chọn DOCX hoặc PDF.")


def normalize_text(text: str) -> str:
    """Chuẩn hóa whitespace và line endings."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _make_title(text: str, max_len: int = 60) -> str:
    first_line = text.split("\n")[0].strip()
    return first_line[:max_len] + "..." if len(first_line) > max_len else first_line


def _split_by_regex(text: str, pattern: re.Pattern, label_prefix: str = "Điều") -> List[Dict[str, Any]]:
    """Chia text theo regex pattern, trích xuất article_number để alignment."""
    matches = list(pattern.finditer(text))
    if len(matches) < 2:
        return []

    chunks = []

    preamble = text[:matches[0].start()].strip()
    if preamble and len(preamble) >= MIN_CHUNK_CHARS:
        chunks.append({
            "clause_no": "0",
            "article_number": "0",  # 0 for preamble
            "section_title": _make_title(preamble),
            "content": preamble,
            "embed_text": preamble,
        })

    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        header = re.sub(r"\s+", " ", match.group(1)).strip()

        if match.lastindex and match.lastindex >= 2:
            clause_no = match.group(2).strip()
            section_title = re.sub(r"\s+", " ", match.group(3)).strip(" .:-–") if match.lastindex >= 3 else ""
        else:
            clause_no = str(i + 1)
            section_title = header

        if not section_title:
            section_title = f"{label_prefix} {clause_no}"

        body = text[match.end():end].strip()
        full_content = f"{header}\n{body}".strip()

        chunks.append({
            "clause_no": clause_no,
            "article_number": clause_no,  # Extract strict number for phase 1 alignment
            "section_title": section_title,
            "content": full_content,
            "embed_text": full_content,
        })

    return chunks


def _split_by_paragraphs(text: str) -> List[Dict[str, Any]]:
    """Tier 3: Chia theo đoạn văn, nhưng gộp lại nếu quá nhiều chunks."""
    lines = text.split("\n")
    chunks: List[str] = []
    current_lines: List[str] = []
    current_len = 0

    def flush():
        nonlocal current_lines, current_len
        if not current_lines:
            return
        block = "\n".join(current_lines).strip()
        if block:
            chunks.append(block)
        current_lines = []
        current_len = 0

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_len >= MIN_CHUNK_CHARS:
                flush()
            continue

        is_header = bool(re.match(r"^\s*[\dIVX]+[\.)\s]+", stripped)) or stripped.isupper()
        if is_header and current_len >= MIN_CHUNK_CHARS:
            flush()

        current_lines.append(stripped)
        current_len += len(stripped)

        if current_len >= MAX_CHUNK_CHARS:
            flush()

    flush()
    
    # Capping chunks
    if len(chunks) > MAX_CHUNKS_PER_DOC:
        target_size = len(text) // (MAX_CHUNKS_PER_DOC // 2)
        merged = []
        buf = []
        buf_len = 0
        for c in chunks:
            buf.append(c)
            buf_len += len(c)
            if buf_len >= target_size:
                merged.append("\n\n".join(buf))
                buf = []
                buf_len = 0
        if buf:
            merged.append("\n\n".join(buf))
        chunks = merged

    result = []
    for idx, block in enumerate(chunks, start=1):
        result.append({
            "clause_no": str(idx),
            "article_number": None, # Fallback, no structural number
            "section_title": _make_title(block),
            "content": block,
            "embed_text": block,
        })
    return result


def smart_split(text: str) -> List[Dict[str, Any]]:
    """Smart chunking 3 cấp.
    Tier 1: Điều/Article
    Tier 2: Chương/Mục hoặc Numbered (1. / 2.)
    Tier 3: Đoạn văn (giới hạn max chunks)
    """
    text = normalize_text(text)

    chunks = _split_by_regex(text, ARTICLE_PATTERN, "Điều")
    if chunks:
        return chunks

    chunks = _split_by_regex(text, SECTION_PATTERN, "Chương")
    if chunks:
        return chunks
        
    chunks = _split_by_regex(text, NUMBERED_HEADING_PATTERN, "Mục")
    if chunks:
        return chunks

    chunks = _split_by_paragraphs(text)
    if len(chunks) >= 2:
        return chunks

    return [{
        "clause_no": "full",
        "article_number": "full",
        "section_title": "Toàn văn",
        "content": text,
        "embed_text": text,
        "chunking_method": "full_text",
    }]


def parse_documents(text_a: str, text_b: str, doc_id: str = "document_compare") -> List[Dict[str, Any]]:
    """Parse và gán metadata version_id cho cả 2 văn bản."""
    chunks_a = smart_split(text_a)
    chunks_b = smart_split(text_b)

    all_chunks = []

    for item in chunks_a:
        all_chunks.append({
            "chunk_id": f"A_{item['clause_no']}",
            "doc_id": doc_id,
            "version_id": "A",
            **item,
        })

    for item in chunks_b:
        all_chunks.append({
            "chunk_id": f"B_{item['clause_no']}",
            "doc_id": doc_id,
            "version_id": "B",
            **item,
        })

    return all_chunks

