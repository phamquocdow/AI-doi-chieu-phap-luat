import json
import re
from pathlib import Path
from difflib import SequenceMatcher

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"


def load_json(name: str):
    with open(DATA_DIR / name, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize_unit(text: str) -> str:
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    return text


def split_into_units(text: str):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n+", "\n", text)
    parts = re.split(r"\n|(?<=;)\s+|(?<=\.)\s+|\(\w+\)", text)
    return [normalize_unit(p) for p in parts if normalize_unit(p)]


def sim(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def best_match(unit, candidates):
    best_idx, best_score = -1, -1.0
    for i, cand in enumerate(candidates):
        score = sim(unit, cand)
        if score > best_score:
            best_idx, best_score = i, score
    return best_idx, best_score


def classify_unit_change(score: float) -> str:
    if score >= 0.95:
        return "unchanged"
    if score >= 0.60:
        return "modified"
    return "deleted"


def main():
    chunks = load_json("chunks.json")
    aligned_pairs = load_json("aligned_pairs.json")
    chunk_map = {c["chunk_id"]: c for c in chunks}

    sentence_level_diffs = []

    for pair in aligned_pairs:
        source_chunk = chunk_map[pair["source_chunk_id"]]
        target_chunk = chunk_map.get(pair["target_chunk_id"]) if pair["target_chunk_id"] else None

        if target_chunk is None:
            sentence_level_diffs.append(
                {
                    "source_chunk_id": source_chunk["chunk_id"],
                    "target_chunk_id": None,
                    "source_clause_no": source_chunk["clause_no"],
                    "target_clause_no": None,
                    "section_title_a": source_chunk["section_title"],
                    "section_title_b": None,
                    "alignment_status": pair["alignment_status"],
                    "final_alignment_score": pair["final_alignment_score"],
                    "unit_changes": [],
                    "content_a": source_chunk["content"],
                    "content_b": "",
                }
            )
            continue

        units_a = split_into_units(source_chunk["content"])
        units_b = split_into_units(target_chunk["content"])

        used_b = set()
        unit_changes = []

        for ua in units_a:
            idx, score = best_match(ua, units_b)
            if idx == -1:
                unit_changes.append({
                    "source_unit": ua,
                    "target_unit": "",
                    "similarity": 0.0,
                    "change_type": "deleted"
                })
                continue

            if score >= 0.60:
                used_b.add(idx)

            unit_changes.append({
                "source_unit": ua,
                "target_unit": units_b[idx],
                "similarity": round(score, 4),
                "change_type": classify_unit_change(score)
            })

        for idx_b, ub in enumerate(units_b):
            if idx_b not in used_b:
                idx_a, score = best_match(ub, units_a)
                if score < 0.60:
                    unit_changes.append({
                        "source_unit": "",
                        "target_unit": ub,
                        "similarity": round(score, 4),
                        "change_type": "added"
                    })

        sentence_level_diffs.append(
            {
                "source_chunk_id": source_chunk["chunk_id"],
                "target_chunk_id": target_chunk["chunk_id"],
                "source_clause_no": source_chunk["clause_no"],
                "target_clause_no": target_chunk["clause_no"],
                "section_title_a": source_chunk["section_title"],
                "section_title_b": target_chunk["section_title"],
                "alignment_status": pair["alignment_status"],
                "final_alignment_score": pair["final_alignment_score"],
                "unit_changes": unit_changes,
                "content_a": source_chunk["content"],
                "content_b": target_chunk["content"],
            }
        )

    output_path = DATA_DIR / "sentence_level_diffs.json"
    output_path.write_text(
        json.dumps(sentence_level_diffs, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"Đã lưu sentence diff vào: {output_path}")


if __name__ == "__main__":
    main()