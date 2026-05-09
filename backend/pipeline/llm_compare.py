"""LLM-powered comparison pipeline — concurrent summarization of computed diffs."""

from typing import List, Dict, Any
import concurrent.futures

from ..core.document_parser import smart_split
from ..core.llm_client import chat_completion, extract_json_object
from ..core.text_differ import compute_word_diff
from ..config import LLM_MAX_WORKERS
from .alignment import align_documents
from .quick_compare import estimate_importance, detect_subtype

def prompt_llm_for_batch_summary(batch: List[Any]) -> Dict[int, str]:
    """Gọi LLM tóm tắt một danh sách các thay đổi cùng lúc (Batching)."""
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
        from ..core.llm_client import chat_completion
        import re
        
        response_text = chat_completion(messages, temperature=0.1, max_tokens=1500)
        
        result = {}
        pattern = r"\[MỤC SỐ\s+(\d+)\](.*?)(?=\[MỤC SỐ\s+\d+\]|$)"
        matches = re.finditer(pattern, response_text, re.DOTALL)
        
        for match in matches:
            idx_str = match.group(1).strip()
            summary_content = match.group(2).strip()
            # Bỏ đi các chuỗi nhiễu thừa nếu có
            if summary_content.startswith(":") or summary_content.startswith("-"):
                summary_content = summary_content[1:].strip()
            if idx_str.isdigit():
                result[int(idx_str)] = summary_content
        return result
    except Exception as e:
        print(f"LLM Batch Error: {e}")
        return {}

def run_llm_compare_from_chunks(chunks_a: List[Dict], chunks_b: List[Dict]) -> Dict[str, Any]:
    """Pipeline so sánh LLM: nhận chunks đã chia sẵn từ Qdrant → align → algorithm diff → concurrent LLM summarize."""
    aligned_pairs = align_documents(chunks_a, chunks_b)

    # Step 1: Compute algorithmic diff for all matched pairs
    needs_llm = []
    for pair in aligned_pairs:
        if pair.is_matched:
            pair.diff = compute_word_diff(pair.text_a, pair.text_b)
            if not pair.diff["is_identical"]:
                needs_llm.append(pair)

    # Step 2: Batch LLM summarization (Gom nhóm để giảm số lần request)
    if needs_llm:
        batch_size = 5 # Tối ưu hóa: Gọi 1 lần tóm tắt được 5 đoạn
        for i in range(0, len(needs_llm), batch_size):
            batch = needs_llm[i:i+batch_size]
            summaries = prompt_llm_for_batch_summary(batch)
            for idx, pair in enumerate(batch):
                pair.llm_summary = summaries.get(idx, pair.diff["change_summary"])

    # Step 3: Build report
    details = []
    stats = {
        "total_clauses_compared": len(aligned_pairs),
        "matched_clauses": 0,
        "modified_clauses": 0,
        "unchanged_clauses": 0,
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

        details.append({
            "source_chunk_id": f"A_{ca['clause_no']}" if ca else None,
            "target_chunk_id": f"B_{cb['clause_no']}" if cb else None,
            "source_clause_no": ca["clause_no"] if ca else "N/A",
            "target_clause_no": cb["clause_no"] if cb else "N/A",
            "section_title_a": ca["section_title"] if ca else "Không có (Đoạn mới)",
            "section_title_b": cb["section_title"] if cb else "Không có (Bị xóa)",
            "alignment_status": "matched" if ca and cb else "no_match",
            "final_alignment_score": round(pair.score, 4),
            "clause_change_type": status,
            "change_subtype": detect_subtype(summary, importance),
            "supported": True,
            "summary": summary,
            "summary_source": "llm" if pair.llm_summary else "quick_rule",
            "importance": importance,
            "citations_a": citations_a,
            "citations_b": citations_b,
            "content_a": pair.text_a,
            "content_b": pair.text_b,
        })

    return {"summary": stats, "details": details}