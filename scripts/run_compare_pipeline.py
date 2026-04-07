import os

steps = [
    "python align_chunks.py",
    "python rerank_alignment.py",
    "python sentence_diff.py",
    "python extract_evidence.py",
    "python apply_guardrail.py",
    "python build_comparison_report.py",
]

for step in steps:
    print("=" * 100)
    print(f"RUN: {step}")
    print("=" * 100)
    code = os.system(step)
    if code != 0:
        print(f"Lỗi tại bước: {step}")
        break