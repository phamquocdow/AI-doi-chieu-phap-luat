import re
import time
import concurrent.futures
from typing import List, Dict, Any

from ..core.text_differ import compute_word_diff
from ..core.llm_client import chat_completion
from ..config import LLM_MAX_WORKERS
from .alignment import align_documents, AlignedPair
from .quick_compare import estimate_importance, detect_subtype

_SECTION_NUM_RE = re.compile(
    r"^[\s]*(?:điều|khoản|mục|chương|phần|article|clause|section)?\s*"
    r"[\d]+(?:[.\-][\d]+)*[.\s:)]*",
    re.IGNORECASE,
)

def _is_numbering_only_change(text_a: str, text_b: str) -> bool:
    norm_a = re.sub(r'\s+', ' ', _SECTION_NUM_RE.sub('', text_a)).strip().lower()
    norm_b = re.sub(r'\s+', ' ', _SECTION_NUM_RE.sub('', text_b)).strip().lower()
    return norm_a == norm_b and len(norm_a) > 0

def _prompt_llm_for_batch_summary(batch: List[AlignedPair]) -> Dict[int, str]:
    if not batch:
        return {}

    prompt_data = []
    for idx, pair in enumerate(batch):
        diff = pair.diff
        removed_text = "\n".join(f"- {p}" for p in diff["removed_phrases"]) if diff["removed_phrases"] else "(không có)"
        added_text = "\n".join(f"- {p}" for p in diff["added_phrases"]) if diff["added_phrases"] else "(không có)"
        context_snippet = pair.text_a[:500] + "..." if len(pair.text_a) > 500 else pair.text_a

        prompt_data.append(f"""
[MỤC SỐ {idx}]
NGỮ CẢNH: {context_snippet}
- CÁC TỪ BỊ XÓA: {removed_text}
- CÁC TỪ ĐƯỢC THÊM: {added_text}
""")

    combined_prompt = "\n".join(prompt_data)

    prompt = f"""Bạn là chuyên gia phân tích pháp lý. Dưới đây là danh sách các thay đổi văn bản được đánh số [MỤC SỐ X].
Nhiệm vụ của bạn là phân tích và viết một "chi tiết kết luận" (khoảng 2-3 câu) giải thích chuyên sâu về bản chất và ý nghĩa pháp lý của sự thay đổi cho TỪNG mục.
KHÔNG được chỉ liệt kê "thay đổi từ A thành B". Hãy giải thích thay đổi đó có ý nghĩa gì (ví dụ: làm rõ quy định, siết chặt điều kiện, thay đổi mốc thời gian...).

DANH SÁCH THAY ĐỔI:
{combined_prompt}

YÊU CẦU TRẢ LỜI: Trả về văn bản thuần túy theo đúng định dạng sau, tuyệt đối không dùng format markdown hay JSON. Bắt đầu bằng [MỤC SỐ X]:
[MỤC SỐ 0]
Nhận xét chi tiết cho mục 0...
[MỤC SỐ 1]
Nhận xét chi tiết cho mục 1...
/no_think"""

    messages = [
        {"role": "system", "content": "Bạn là chuyên gia pháp lý. Hãy tuân thủ nghiêm ngặt định dạng văn bản yêu cầu."},
        {"role": "user", "content": prompt},
    ]

    try:
        response_text = chat_completion(messages, temperature=0.1, max_tokens=1500)

        result = {}
        pattern = r"\[MỤC SỐ\s+(\d+)\](.*?)(?=\[MỤC SỐ\s+\d+\]|$)"
        matches = re.finditer(pattern, response_text, re.DOTALL)

        for match in matches:
            idx_str = match.group(1).strip()
            summary_content = match.group(2).strip()
            if summary_content.startswith(":") or summary_content.startswith("-"):
                summary_content = summary_content[1:].strip()
            if idx_str.isdigit():
                result[int(idx_str)] = summary_content
        return result
    except Exception as e:
        print(f"LLM Batch Error: {e}")
        return {}

def run_llm_compare_from_chunks(chunks_a: List[Dict], chunks_b: List[Dict]) -> Dict[str, Any]:
    pipeline_start = time.time()

    print("Step 1: Alignment...")
    aligned_pairs = align_documents(chunks_a, chunks_b)

    print("Step 2: Computing word-level diffs...")
    t_diff = time.time()
    needs_llm = []
    numbering_only_count = 0

    for pair in aligned_pairs:
        if pair.is_matched:
            if _is_numbering_only_change(pair.text_a, pair.text_b):
                pair.diff = {
                    "is_identical": True,
                    "added_phrases": [],
                    "removed_phrases": [],
                    "diff_tokens": [{"type": "equal", "value": pair.text_b}],
                    "change_summary": "Chỉ thay đổi số thứ tự/định dạng, nội dung giống nhau.",
                    "ratio": 1.0,
                }
                pair.llm_summary = "Chỉ thay đổi số thứ tự hoặc định dạng, nội dung pháp lý giống nhau."
                numbering_only_count += 1
                continue

            pair.diff = compute_word_diff(pair.text_a, pair.text_b)
            if not pair.diff["is_identical"]:
                needs_llm.append(pair)

    print(f"Diff completed in {time.time() - t_diff:.2f}s")
    print(f"Numbering-only skipped: {numbering_only_count}")
    print(f"Needs LLM: {len(needs_llm)} pairs")

    if needs_llm:
        t_llm = time.time()
        batch_size = 5
        batches = [needs_llm[i:i+batch_size] for i in range(0, len(needs_llm), batch_size)]

        print(f"LLM: {len(batches)} batches x {LLM_MAX_WORKERS} workers...")

        with concurrent.futures.ThreadPoolExecutor(max_workers=LLM_MAX_WORKERS) as executor:
            future_map = {
                executor.submit(_prompt_llm_for_batch_summary, batch): batch
                for batch in batches
            }

            for future in concurrent.futures.as_completed(future_map):
                batch = future_map[future]
                try:
                    summaries = future.result()
                    for idx, pair in enumerate(batch):
                        pair.llm_summary = summaries.get(idx, pair.diff["change_summary"])
                except Exception as e:
                    print(f"LLM batch failed: {e}")
                    for pair in batch:
                        pair.llm_summary = pair.diff["change_summary"]

        print(f"LLM completed in {time.time() - t_llm:.2f}s")

    details = []
    stats = {
        "total_clauses_compared": len(aligned_pairs),
        "matched_clauses": 0,
        "modified_clauses": 0,
        "unchanged_clauses": 0,
        "exact_match_clauses": 0,
        "blocked_or_unsupported_clauses": 0,
    }

    for pair in aligned_pairs:
        ca = pair.chunk_a
        cb = pair.chunk_b

        status = "blocked"
        summary = ""
        importance = "low"
        citations_a = []
        citations_b = []

        if not ca:
            status = "added"
            summary = "Đoạn này được thêm mới."
            importance = "high"
            citations_b = [pair.text_b[:120] + "..."] if len(pair.text_b) > 120 else [pair.text_b]
            stats["modified_clauses"] += 1

        elif not cb:
            status = "deleted"
            summary = "Đoạn này đã bị xóa."
            importance = "high"
            citations_a = [pair.text_a[:120] + "..."] if len(pair.text_a) > 120 else [pair.text_a]
            stats["modified_clauses"] += 1

        else:
            diff = pair.diff
            stats["matched_clauses"] += 1

            if pair.method == "exact":
                stats["exact_match_clauses"] += 1

            if diff["is_identical"]:
                status = "unchanged"
                summary = diff["change_summary"]
                stats["unchanged_clauses"] += 1
            else:
                status = "modified"
                summary = pair.llm_summary if pair.llm_summary else diff["change_summary"]
                importance = estimate_importance(diff)
                citations_a = diff["removed_phrases"]
                citations_b = diff["added_phrases"]
                stats["modified_clauses"] += 1

        diff_tokens = []
        if ca and cb and hasattr(pair, "diff") and pair.diff:
            diff_tokens = pair.diff.get("diff_tokens", [])
        elif not ca:
            diff_tokens = [{"type": "added", "value": pair.text_b}]
        elif not cb:
            diff_tokens = [{"type": "removed", "value": pair.text_a}]

        details.append({
            "source_chunk_id": f"A_{ca['clause_no']}" if ca else None,
            "target_chunk_id": f"B_{cb['clause_no']}" if cb else None,
            "source_clause_no": ca["clause_no"] if ca else "N/A",
            "target_clause_no": cb["clause_no"] if cb else "N/A",
            "section_title_a": ca["section_title"] if ca else "Không có (Đoạn mới)",
            "section_title_b": cb["section_title"] if cb else "Không có (Bị xóa)",
            "alignment_status": "matched" if ca and cb else "no_match",
            "alignment_method": pair.method,
            "final_alignment_score": round(pair.score, 4),
            "clause_change_type": status,
            "change_subtype": detect_subtype(summary, importance),
            "supported": True,
            "summary": summary,
            "summary_source": "llm" if pair.llm_summary and status == "modified" else "quick_rule",
            "importance": importance,
            "citations_a": citations_a,
            "citations_b": citations_b,
            "content_a": pair.text_a,
            "content_b": pair.text_b,
            "diff_tokens": diff_tokens,
        })

    def _order_chunks(chunks):
        def sort_key(c):
            no = c.get("clause_no", "0")
            try:
                return (0, int(no))
            except (ValueError, TypeError):
                return (1, str(no))
        return sorted(chunks, key=sort_key)

    ordered_a = _order_chunks(chunks_a)
    ordered_b = _order_chunks(chunks_b)
    full_text_a = "\n\n".join(c.get("content", "") for c in ordered_a)
    full_text_b = "\n\n".join(c.get("content", "") for c in ordered_b)

    total_time = time.time() - pipeline_start
    print(f"Pipeline hoàn tất trong {total_time:.2f}s")
    print(f"Total: {stats['total_clauses_compared']} | "
          f"Exact: {stats['exact_match_clauses']} | "
          f"Modified: {stats['modified_clauses']} | "
          f"Unchanged: {stats['unchanged_clauses']}")

    return {
        "summary": stats,
        "details": details,
        "full_text_a": full_text_a,
        "full_text_b": full_text_b,
    }
