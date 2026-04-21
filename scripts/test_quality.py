import json
from collections import Counter
from pathlib import Path
from statistics import mean


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"


def load_json(filename: str):
    path = DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Không tìm thấy file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def pct(n: int, d: int) -> str:
    if d == 0:
        return "0.00%"
    return f"{(n / d) * 100:.2f}%"


def build_report_text() -> str:
    aligned_pairs = load_json("aligned_pairs.json")
    evidence_guarded = load_json("evidence_guarded.json")
    comparison_report = load_json("comparison_report.json")

    total_pairs = len(aligned_pairs)
    status_counts = Counter(item.get("alignment_status", "unknown") for item in aligned_pairs)
    scores = [float(item.get("final_alignment_score", 0.0)) for item in aligned_pairs]

    source_id_counts = Counter(item.get("source_chunk_id", "") for item in aligned_pairs)
    duplicated_sources = {k: v for k, v in source_id_counts.items() if k and v > 1}

    guardrail_counts = Counter(item.get("guardrail_status", "unknown") for item in evidence_guarded)
    supported_count = sum(1 for item in evidence_guarded if item.get("supported") is True)
    blocked_count = len(evidence_guarded) - supported_count

    subtype_counts = Counter(item.get("change_subtype", "unknown") for item in evidence_guarded)
    summary = comparison_report.get("summary", {})

    modified_examples = [
        item
        for item in evidence_guarded
        if item.get("clause_change_type") == "modified" and item.get("supported") is True
    ][:3]

    lines = []
    lines.append("=" * 88)
    lines.append("KET QUA TEST CHAT LUONG TUAN 11")
    lines.append("=" * 88)
    lines.append("")

    lines.append("1) Tong quan alignment")
    lines.append(f"- Tong cap doi chieu: {total_pairs}")
    lines.append(
        f"- Matched: {status_counts.get('matched', 0)} ({pct(status_counts.get('matched', 0), total_pairs)})"
    )
    lines.append(
        f"- Weak match: {status_counts.get('weak_match', 0)} ({pct(status_counts.get('weak_match', 0), total_pairs)})"
    )
    lines.append(
        f"- No match: {status_counts.get('no_match', 0)} ({pct(status_counts.get('no_match', 0), total_pairs)})"
    )

    if scores:
        lines.append(f"- Diem alignment trung binh: {mean(scores):.4f}")
        lines.append(f"- Diem nho nhat/lon nhat: {min(scores):.4f} / {max(scores):.4f}")
    lines.append("")

    lines.append("2) Tong quan guardrail")
    lines.append(f"- So dieu khoan supported: {supported_count}")
    lines.append(f"- So dieu khoan blocked: {blocked_count}")
    lines.append("- Phan bo guardrail_status:")
    for key in sorted(guardrail_counts.keys()):
        lines.append(f"  + {key}: {guardrail_counts[key]}")
    lines.append("")

    lines.append("3) Tong quan thay doi")
    lines.append(
        f"- Modified clauses (report): {summary.get('modified_clauses', 0)}"
    )
    lines.append(
        f"- Unchanged clauses (report): {summary.get('unchanged_clauses', 0)}"
    )
    lines.append("- Phan bo change_subtype:")
    for key in sorted(subtype_counts.keys()):
        lines.append(f"  + {key}: {subtype_counts[key]}")
    lines.append("")

    lines.append("4) Kiem tra chat luong du lieu")
    if duplicated_sources:
        lines.append("- Canh bao: Co source_chunk_id bi lap trong aligned_pairs:")
        for key, val in sorted(duplicated_sources.items()):
            lines.append(f"  + {key}: {val} lan")
    else:
        lines.append("- Khong phat hien source_chunk_id bi lap trong aligned_pairs.")
    lines.append("")

    lines.append("5) Mau bang chung (3 dieu khoan modified dau tien)")
    if not modified_examples:
        lines.append("- Khong co vi du modified nao.")
    else:
        for idx, item in enumerate(modified_examples, start=1):
            lines.append(
                f"- Vi du {idx}: Dieu {item.get('source_clause_no')} | score={item.get('final_alignment_score')} | subtype={item.get('change_subtype')}"
            )
            cita = item.get("citations_a", [])
            citb = item.get("citations_b", [])
            if cita:
                lines.append(f"  + A: {cita[0][:140]}")
            if citb:
                lines.append(f"  + B: {citb[0][:140]}")

    lines.append("")


    return "\n".join(lines)


def main() -> None:
    report_text = build_report_text()

    txt_out = DATA_DIR / "test_output.txt"
    md_out = DATA_DIR / "test_output.md"

    txt_out.write_text(report_text, encoding="utf-8")
    md_out.write_text("# Kết quả test chất lượng \n\n" + report_text.replace("\n", "  \n"), encoding="utf-8")

    print(report_text)
    print("\nDa luu file:")
    print(f"- {txt_out}")
    print(f"- {md_out}")


if __name__ == "__main__":
    main()