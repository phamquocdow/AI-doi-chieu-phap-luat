import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"


def load_json(name: str):
    with open(DATA_DIR / name, "r", encoding="utf-8") as f:
        return json.load(f)


def tokenize_title(text: str):
    text = text.lower().strip()
    text = re.sub(r"[^a-zA-ZÀ-ỹ0-9\s]", " ", text)
    return set(t for t in text.split() if t)


def title_match_score(a: str, b: str) -> float:
    ta = tokenize_title(a)
    tb = tokenize_title(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb)
    return inter / union if union else 0.0


def clause_match_score(a_clause: str, b_clause: str) -> float:
    if a_clause == b_clause:
        return 1.0
    try:
        a_num = int(a_clause)
        b_num = int(b_clause)
        if abs(a_num - b_num) == 1:
            return 0.3
    except ValueError:
        pass
    return 0.0


def final_alignment_score(embedding_score: float, clause_score: float, title_score: float) -> float:
    return 0.45 * embedding_score + 0.35 * clause_score + 0.20 * title_score


def decide_status(score: float) -> str:
    if score >= 0.75:
        return "matched"
    if score >= 0.50:
        return "weak_match"
    return "no_match"


def main():
    candidates_data = load_json("alignment_candidates.json")
    aligned_pairs = []

    for item in candidates_data:
        best = None
        best_score = -1.0

        for cand in item["candidates"]:
            emb = cand["embedding_score"]
            clause_score = clause_match_score(item["source_clause_no"], cand["target_clause_no"])
            title_score = title_match_score(item["source_section_title"], cand["target_section_title"])
            score = final_alignment_score(emb, clause_score, title_score)

            current = {
                "source_chunk_id": item["source_chunk_id"],
                "source_clause_no": item["source_clause_no"],
                "source_section_title": item["source_section_title"],
                "target_chunk_id": cand["target_chunk_id"],
                "target_clause_no": cand["target_clause_no"],
                "target_section_title": cand["target_section_title"],
                "embedding_score": round(emb, 6),
                "clause_match_score": round(clause_score, 6),
                "title_match_score": round(title_score, 6),
                "final_alignment_score": round(score, 6),
            }

            if score > best_score:
                best_score = score
                best = current

        if best is None:
            best = {
                "source_chunk_id": item["source_chunk_id"],
                "source_clause_no": item["source_clause_no"],
                "source_section_title": item["source_section_title"],
                "target_chunk_id": None,
                "target_clause_no": None,
                "target_section_title": None,
                "embedding_score": 0.0,
                "clause_match_score": 0.0,
                "title_match_score": 0.0,
                "final_alignment_score": 0.0,
            }

        best["alignment_status"] = decide_status(best["final_alignment_score"])
        aligned_pairs.append(best)

    output_path = DATA_DIR / "aligned_pairs.json"
    output_path.write_text(
        json.dumps(aligned_pairs, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"Đã lưu kết quả re-rank alignment vào: {output_path}")


if __name__ == "__main__":
    main()