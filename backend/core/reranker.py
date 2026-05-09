"""Cross-encoder Reranker — xác minh matching quality bằng cross-encoder.
Sử dụng FlagReranker hoặc CrossEncoder với graceful fallback.
"""

import numpy as np
from typing import List, Optional

from ..config import RERANKER_ENABLED, RERANKER_MODEL, RERANKER_THRESHOLD

_reranker = None
_reranker_available = None  # None = chưa thử load, True/False = đã biết


def _load_reranker():
    """Lazy-load reranker model. Thử FlagEmbedding → CrossEncoder → disable."""
    global _reranker, _reranker_available

    if _reranker_available is not None:
        return _reranker

    if not RERANKER_ENABLED:
        _reranker_available = False
        print("Reranker disabled by config.")
        return None

    # Attempt 1: FlagEmbedding (reference repo pattern)
    try:
        from FlagEmbedding import FlagReranker
        _reranker = FlagReranker(RERANKER_MODEL, use_fp16=False)
        _reranker_available = True
        print(f"Reranker loaded (FlagReranker): {RERANKER_MODEL}")
        return _reranker
    except Exception as e:
        print(f"FlagEmbedding unavailable ({e}), trying CrossEncoder...")

    # Attempt 2: sentence-transformers CrossEncoder
    try:
        from sentence_transformers import CrossEncoder
        _reranker = CrossEncoder(RERANKER_MODEL)
        _reranker_available = True
        print(f"Reranker loaded (CrossEncoder): {RERANKER_MODEL}")
        return _reranker
    except Exception as e2:
        print(f"Reranker unavailable: {e2}. Pipeline sẽ dùng cosine+BM25.")
        _reranker_available = False
        return None


def is_reranker_available() -> bool:
    """Kiểm tra reranker có sẵn không."""
    _load_reranker()
    return bool(_reranker_available)


def rerank_pairs(query_texts: List[str], passage_texts: List[str]) -> Optional[np.ndarray]:
    """Score các cặp query-passage bằng cross-encoder.
    
    Returns:
        np.ndarray of scores nếu reranker available, None nếu không.
    """
    reranker = _load_reranker()
    if reranker is None:
        return None

    pairs = list(zip(query_texts, passage_texts))
    if not pairs:
        return np.array([])

    try:
        # FlagReranker interface
        if hasattr(reranker, 'compute_score'):
            scores = reranker.compute_score(pairs, normalize=True)
            if isinstance(scores, (int, float)):
                scores = [scores]
            return np.array(scores, dtype=float)

        # CrossEncoder interface
        if hasattr(reranker, 'predict'):
            scores = reranker.predict(pairs)
            return np.array(scores, dtype=float)

    except Exception as e:
        print(f"Reranker scoring error: {e}")
        return None

    return None


def rerank_matrix(texts_a: List[str], texts_b: List[str]) -> Optional[np.ndarray]:
    """Tính ma trận rerank scores cho tất cả cặp A×B.
    
    Returns:
        np.ndarray shape (len_a, len_b) hoặc None nếu reranker unavailable.
    """
    reranker = _load_reranker()
    if reranker is None:
        return None

    n_a, n_b = len(texts_a), len(texts_b)
    if n_a == 0 or n_b == 0:
        return np.zeros((n_a, n_b))

    # Build all pairs
    all_queries = []
    all_passages = []
    for ta in texts_a:
        for tb in texts_b:
            all_queries.append(ta)
            all_passages.append(tb)

    scores = rerank_pairs(all_queries, all_passages)
    if scores is None:
        return None

    return scores.reshape(n_a, n_b)
