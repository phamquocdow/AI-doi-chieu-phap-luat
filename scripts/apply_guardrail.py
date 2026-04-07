import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"


def load_json(name: str):
    with open(DATA_DIR / name, "r", encoding="utf-8") as f:
        return json.load(f)


def determine_change_type(unit_changes):
    change_types = {x["change_type"] for x in unit_changes}
    if not change_types or change_types == {"unchanged"}:
        return "unchanged"
    return "modified"


def main():
    items = load_json("evidence_raw.json")
    guarded = []

    for item in items:
        alignment_status = item["alignment_status"]
        clause_change_type = determine_change_type(item["unit_changes"])
        has_evidence = bool(item["citations_a"] or item["citations_b"])

        supported = False
        guardrail_status = ""
        summary_seed = ""

        if alignment_status == "no_match":
            guardrail_status = "blocked_no_match"
            summary_seed = "Không đủ bằng chứng để kết luận do không tìm được điều khoản tương ứng đáng tin cậy."
        elif alignment_status == "weak_match":
            guardrail_status = "blocked_weak_alignment"
            summary_seed = "Không đủ bằng chứng để kết luận có thay đổi rõ ràng do đối sánh còn yếu."
        elif clause_change_type == "unchanged":
            guardrail_status = "supported_unchanged"
            supported = True
            summary_seed = f"Điều {item['source_clause_no']} hầu như không có thay đổi đáng kể giữa phiên bản A và B."
        elif not has_evidence:
            guardrail_status = "blocked_no_evidence"
            summary_seed = "Không đủ bằng chứng để kết luận có thay đổi rõ ràng."
        else:
            guardrail_status = "supported_modified"
            supported = True
            summary_seed = f"Điều {item['source_clause_no']} có thay đổi nội dung giữa phiên bản A và B."

        guarded.append(
            {
                **item,
                "clause_change_type": clause_change_type,
                "supported": supported,
                "guardrail_status": guardrail_status,
                "summary_seed": summary_seed,
            }
        )

    output_path = DATA_DIR / "evidence_guarded.json"
    output_path.write_text(
        json.dumps(guarded, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"Đã lưu evidence sau guardrail vào: {output_path}")


if __name__ == "__main__":
    main()