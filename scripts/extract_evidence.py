import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"


def load_json(name: str):
    with open(DATA_DIR / name, "r", encoding="utf-8") as f:
        return json.load(f)


def detect_subtype(unit_changes):
    text_blob = " ".join(
        [x.get("source_unit", "") + " " + x.get("target_unit", "") for x in unit_changes]
    ).lower()

    if re.search(r"\d", text_blob):
        if any(k in text_blob for k in ["lương", "đồng/tháng", "vnđ"]):
            return "numeric_change"
        if any(k in text_blob for k in ["ngày", "giờ", "thứ", "8h", "17h", "18h"]):
            return "time_change"

    if any(k in text_blob for k in ["bí mật", "tiết lộ", "bên thứ ba"]):
        return "confidentiality_change"

    if any(k in text_blob for k in ["tranh chấp", "tòa án", "thương lượng"]):
        return "dispute_resolution_change"

    if any(k in text_blob for k in ["bồi thường", "chấm dứt", "báo trước"]):
        return "termination_or_penalty_change"

    return "general_change"


def pick_best_evidence(unit_changes):
    changed = [x for x in unit_changes if x["change_type"] in {"modified", "added", "deleted"}]

    evidence_a, evidence_b = [], []
    for item in changed[:3]:
        if item["source_unit"]:
            evidence_a.append(item["source_unit"])
        if item["target_unit"]:
            evidence_b.append(item["target_unit"])

    return evidence_a, evidence_b


def main():
    items = load_json("sentence_level_diffs.json")
    outputs = []

    for item in items:
        subtype = detect_subtype(item["unit_changes"])
        evidence_a, evidence_b = pick_best_evidence(item["unit_changes"])

        outputs.append(
            {
                "source_chunk_id": item["source_chunk_id"],
                "target_chunk_id": item["target_chunk_id"],
                "source_clause_no": item["source_clause_no"],
                "target_clause_no": item["target_clause_no"],
                "section_title_a": item["section_title_a"],
                "section_title_b": item["section_title_b"],
                "alignment_status": item["alignment_status"],
                "final_alignment_score": item["final_alignment_score"],
                "change_subtype": subtype,
                "citations_a": evidence_a,
                "citations_b": evidence_b,
                "content_a": item["content_a"],
                "content_b": item["content_b"],
                "unit_changes": item["unit_changes"],
            }
        )

    output_path = DATA_DIR / "evidence_raw.json"
    output_path.write_text(
        json.dumps(outputs, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"Đã lưu evidence raw vào: {output_path}")


if __name__ == "__main__":
    main()