import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"

INPUT_FILES = [
    ("contract_A.txt", "A"),
    ("contract_B.txt", "B"),
]

DOC_ID = "labor_contract_demo"


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def split_by_articles(text: str):
    """
    Tách văn bản theo từng 'Điều x' với nhiều biến thể định dạng.
    Giữ lại tiêu đề điều để dùng làm chunk.
    """
    pattern = r"(?im)^\s*(Điều\s+(\d+)\s*[:\.-]?\s*([^\n]*))\s*$"
    matches = list(re.finditer(pattern, text, flags=re.IGNORECASE | re.MULTILINE))

    chunks = []
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)

        header = re.sub(r"\s+", " ", match.group(1)).strip()
        clause_no = match.group(2).strip()
        section_title = re.sub(r"\s+", " ", match.group(3)).strip(" .:-")
        if not section_title:
            section_title = f"Điều {clause_no}"

        body = text[match.end():end].strip()
        full_content = f"{header}\n{body}".strip()

        chunks.append(
            {
                "clause_no": clause_no,
                "section_title": section_title,
                "content": full_content,
                "embed_text": f"Điều {clause_no} - {section_title}. {body}".strip(),
            }
        )
    return chunks


def main():
    all_chunks = []

    for filename, version_id in INPUT_FILES:
        file_path = DATA_DIR / filename
        raw_text = file_path.read_text(encoding="utf-8")
        text = normalize_text(raw_text)

        article_chunks = split_by_articles(text)

        for item in article_chunks:
            chunk = {
                "chunk_id": f"{version_id}_{item['clause_no']}",
                "doc_id": DOC_ID,
                "version_id": version_id,
                "clause_no": item["clause_no"],
                "section_title": item["section_title"],
                "content": item["content"],
                "embed_text": item["embed_text"],
            }
            all_chunks.append(chunk)

    output_path = DATA_DIR / "chunks.json"
    output_path.write_text(
        json.dumps(all_chunks, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Đã lưu {len(all_chunks)} chunks vào: {output_path}")


if __name__ == "__main__":
    main()