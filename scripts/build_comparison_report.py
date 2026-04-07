import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"


def load_json(name: str):
    with open(DATA_DIR / name, "r", encoding="utf-8") as f:
        return json.load(f)


def estimate_importance(change_subtype, supported):
    if not supported:
        return "low"
    if change_subtype in {"numeric_change", "time_change", "termination_or_penalty_change", "dispute_resolution_change"}:
        return "high"
    if change_subtype in {"confidentiality_change", "general_change"}:
        return "medium"
    return "low"


def build_stats(items):
    stats = {
        "total": len(items),
        "matched": 0,
        "modified": 0,
        "unchanged": 0,
        "blocked": 0,
    }

    for x in items:
        if x["alignment_status"] == "matched":
            stats["matched"] += 1

        if not x["supported"]:
            stats["blocked"] += 1
        elif x["clause_change_type"] == "unchanged":
            stats["unchanged"] += 1
        elif x["clause_change_type"] == "modified":
            stats["modified"] += 1

    return stats


def main():
    items = load_json("evidence_guarded.json")
    stats = build_stats(items)

    report_items = []
    for item in items:
        report_items.append(
            {
                **item,
                "summary": item["summary_seed"],
                "importance": estimate_importance(item["change_subtype"], item["supported"]),
                "summary_source": "rule_based",
            }
        )

    report_json = {
        "summary": {
            "total_clauses_compared": stats["total"],
            "matched_clauses": stats["matched"],
            "modified_clauses": stats["modified"],
            "unchanged_clauses": stats["unchanged"],
            "blocked_or_unsupported_clauses": stats["blocked"],
        },
        "details": report_items,
    }

    json_output = DATA_DIR / "comparison_report.json"
    json_output.write_text(
        json.dumps(report_json, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    md = []
    md.append("# BÁO CÁO SO SÁNH HAI PHIÊN BẢN VĂN BẢN")
    md.append("")
    md.append("## 1. Tổng quan")
    md.append(f"- Tổng số điều khoản so sánh: {stats['total']}")
    md.append(f"- Số điều khoản matched: {stats['matched']}")
    md.append(f"- Số điều khoản có thay đổi: {stats['modified']}")
    md.append(f"- Số điều khoản hầu như không thay đổi: {stats['unchanged']}")
    md.append(f"- Số điều khoản bị chặn kết luận hoặc thiếu bằng chứng: {stats['blocked']}")
    md.append("")
    md.append("## 2. Chi tiết")
    md.append("")

    for i, item in enumerate(report_items, start=1):
        md.append(f"### {i}. Điều {item['source_clause_no']} - {item['section_title_a']}")
        md.append(f"- Cặp so sánh: `{item['source_chunk_id']}` ↔ `{item['target_chunk_id']}`")
        md.append(f"- Alignment: `{item['alignment_status']}`")
        md.append(f"- Điểm alignment: `{item['final_alignment_score']}`")
        md.append(f"- Loại thay đổi: `{item['clause_change_type']}`")
        md.append(f"- Kiểu thay đổi: `{item['change_subtype']}`")
        md.append(f"- Supported: `{item['supported']}`")
        md.append(f"- Importance: `{item['importance']}`")
        md.append(f"- Kết luận: {item['summary']}")

        if item["citations_a"] or item["citations_b"]:
            md.append("- Bằng chứng phiên bản A:")
            for c in item["citations_a"]:
                md.append(f"  - {c}")
            md.append("- Bằng chứng phiên bản B:")
            for c in item["citations_b"]:
                md.append(f"  - {c}")

        md.append("")

    md_output = DATA_DIR / "comparison_report.md"
    md_output.write_text("\n".join(md), encoding="utf-8")

    print(f"Đã sinh report JSON: {json_output}")
    print(f"Đã sinh report Markdown: {md_output}")


if __name__ == "__main__":
    main()