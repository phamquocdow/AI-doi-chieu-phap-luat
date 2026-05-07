import re
import difflib
import unicodedata
from typing import Dict, Any, List

def normalize_for_diff(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def _extract_phrases(diff_tokens: List[Dict[str, str]], target_type: str) -> List[str]:
    phrases = []
    current_phrase = []
    
    for token in diff_tokens:
        if token["type"] == target_type:
            current_phrase.append(token["value"])
        else:
            if current_phrase:
                phrases.append(" ".join(current_phrase))
                current_phrase = []
                
    if current_phrase:
        phrases.append(" ".join(current_phrase))
        
    return phrases

def _is_trivial(phrase: str) -> bool:
    clean_phrase = re.sub(r"[^\w\s]", "", phrase).strip()
    return len(clean_phrase) < 2

def compute_word_diff(text_a: str, text_b: str) -> Dict[str, Any]:
    if not text_a and not text_b:
        return {"is_identical": True, "added_phrases": [], "removed_phrases": [], "diff_tokens": [], "change_summary": "Giống hệt nhau."}

    def pad_punctuation(text):
        return re.sub(r"([.,;:!?()])", r" \1 ", text)
        
    norm_a = normalize_for_diff(pad_punctuation(text_a))
    norm_b = normalize_for_diff(pad_punctuation(text_b))
    
    words_a = norm_a.split()
    words_b = norm_b.split()
    
    matcher = difflib.SequenceMatcher(None, words_a, words_b)
    ratio = matcher.ratio()
    
    if norm_a == norm_b:
        return {
            "is_identical": True,
            "added_phrases": [],
            "removed_phrases": [],
            "diff_tokens": [{"type": "equal", "value": norm_b}],
            "change_summary": "Hai đoạn không có sự thay đổi về nội dung.",
            "ratio": ratio
        }
        
    differ = difflib.ndiff(words_a, words_b)
    diff_tokens = []
    
    for op in differ:
        code = op[0]
        word = op[2:]
        if code == " ":
            diff_tokens.append({"type": "equal", "value": word})
        elif code == "+":
            diff_tokens.append({"type": "added", "value": word})
        elif code == "-":
            diff_tokens.append({"type": "removed", "value": word})
            
    def cleanup_punctuation(phrases):
        cleaned = []
        for p in phrases:
            c = re.sub(r"\s+([.,;:!?()])", r"\1", p)
            c = re.sub(r"([()])\s+", r"\1", c)
            cleaned.append(c.strip())
        return cleaned

    raw_added_phrases = _extract_phrases(diff_tokens, "added")
    raw_removed_phrases = _extract_phrases(diff_tokens, "removed")
    
    added_phrases = cleanup_punctuation(raw_added_phrases)
    removed_phrases = cleanup_punctuation(raw_removed_phrases)
    
    meaningful_added = [p for p in added_phrases if not _is_trivial(p)] or added_phrases
    meaningful_removed = [p for p in removed_phrases if not _is_trivial(p)] or removed_phrases
    
    summary_parts = []
    if meaningful_removed and meaningful_added:
        longest_removed = max(meaningful_removed, key=len)
        longest_added = max(meaningful_added, key=len)
        
        # Cắt ngắn nếu quá dài
        r_snippet = longest_removed if len(longest_removed) < 50 else longest_removed[:47] + "..."
        a_snippet = longest_added if len(longest_added) < 50 else longest_added[:47] + "..."
        
        summary_parts.append(f"Thay đổi từ '{r_snippet}' thành '{a_snippet}'.")
    elif meaningful_added:
        longest_added = max(meaningful_added, key=len)
        a_snippet = longest_added if len(longest_added) < 50 else longest_added[:47] + "..."
        summary_parts.append(f"Thêm nội dung: '{a_snippet}'.")
    elif meaningful_removed:
        longest_removed = max(meaningful_removed, key=len)
        r_snippet = longest_removed if len(longest_removed) < 50 else longest_removed[:47] + "..."
        summary_parts.append(f"Xóa nội dung: '{r_snippet}'.")
        
    summary = " ".join(summary_parts) if summary_parts else "Có thay đổi nhỏ về từ ngữ."
    if len(meaningful_added) + len(meaningful_removed) > 2:
        summary += " (và một số thay đổi khác)"
        
    return {
        "is_identical": False,
        "added_phrases": meaningful_added,
        "removed_phrases": meaningful_removed, 
        "diff_tokens": diff_tokens,
        "change_summary": summary,
        "ratio": ratio
    }
