"""Quick compare — rule-based so sánh tức thì (không cần LLM)."""

from typing import Dict, Any

from ..core.document_parser import smart_split
from ..core.text_differ import compute_word_diff
from .alignment import align_documents

def detect_subtype(summary: str, importance: str) -> str:
    """Xác định subtype cơ bản."""
    summary_lower = summary.lower()
    if any(k in summary_lower for k in ["lương", "vnđ", "vnd", "tiền", "đồng"]):
        return "numeric_change"
    if any(k in summary_lower for k in ["ngày", "tháng", "năm", "giờ"]):
        return "time_change"
    if importance == "high":
        return "important_change"
    return "general_change"

def estimate_importance(diff: Dict[str, Any]) -> str:
    """Ước tính tầm quan trọng dựa trên diff."""
    if diff["is_identical"]:
        return "low"
    
    added_len = sum(len(p) for p in diff["added_phrases"])
    removed_len = sum(len(p) for p in diff["removed_phrases"])
    
    if added_len > 100 or removed_len > 100:
        return "high"
        
    summary_lower = diff["change_summary"].lower()
    if any(k in summary_lower for k in ["lương", "phạt", "bồi thường", "chấm dứt", "hủy bỏ"]):
        return "high"
        
    if diff["ratio"] < 0.8:
        return "medium"
        
    return "low"

def run_quick_compare(text_a: str, text_b: str) -> Dict[str, Any]:
    """Rule-based comparison sử dụng word-level diff (difflib)."""
    chunks_a = smart_split(text_a)
    chunks_b = smart_split(text_b)
    
    aligned_pairs = align_documents(chunks_a, chunks_b)
    
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
            diff = compute_word_diff(pair.text_a, pair.text_b)
            stats["matched_clauses"] += 1
            
            if diff["is_identical"]:
                status = "unchanged"
                summary = diff["change_summary"]
                stats["unchanged_clauses"] += 1
            else:
                status = "modified"
                summary = diff["change_summary"]
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
            "summary_source": "quick_rule",
            "importance": importance,
            "citations_a": citations_a,
            "citations_b": citations_b,
            "content_a": pair.text_a,
            "content_b": pair.text_b,
        })

    return {
        "summary": stats,
        "details": details,
    }

