import re
import numpy as np
from typing import List, Dict, Any, Optional

from ..core.bm25_scorer import BM25Scorer
from ..core.embedding_manager import get_embedder
from ..core.reranker import rerank_matrix, is_reranker_available
from ..config import (
    DENSE_WEIGHT, BM25_WEIGHT, SIMILARITY_THRESHOLD,
    HUNGARIAN_ENABLED, EXACT_MATCH_ENABLED, RERANKER_THRESHOLD,
)

class AlignedPair:
    def __init__(self, chunk_a: Dict = None, chunk_b: Dict = None, score: float = 0.0, method: str = "none"):
        self.chunk_a = chunk_a
        self.chunk_b = chunk_b
        self.score = score
        self.method = method

        self.is_matched = chunk_a is not None and chunk_b is not None
        self.text_a = chunk_a["content"] if chunk_a else ""
        self.text_b = chunk_b["content"] if chunk_b else ""

        self.diff = None
        self.llm_summary = None

_SECTION_NUM_RE = re.compile(
    r"^[\s]*(?:điều|khoản|mục|chương|phần|article|clause|section)?\s*"
    r"[\d]+(?:[.\-][\d]+)*[.\s:)]*",
    re.IGNORECASE,
)

def _normalize_for_exact_match(text: str) -> str:
    text = re.sub(r'\s+', ' ', text).strip().lower()
    text = _SECTION_NUM_RE.sub('', text).strip()
    return text

def _compute_dense_scores(texts_a: List[str], texts_b: List[str],
                          vecs_a: Optional[np.ndarray] = None,
                          vecs_b: Optional[np.ndarray] = None) -> np.ndarray:
    if vecs_a is not None and vecs_b is not None:
        return np.dot(vecs_a, vecs_b.T)

    embedder = get_embedder()
    vecs_a = embedder.encode(texts_a, normalize_embeddings=True)
    vecs_b = embedder.encode(texts_b, normalize_embeddings=True)
    return np.dot(vecs_a, vecs_b.T)

def _compute_bm25_scores(texts_a: List[str], texts_b: List[str]) -> np.ndarray:
    bm25 = BM25Scorer(texts_b)
    sparse_scores = np.array([bm25.score(t) for t in texts_a])
    max_sparse = sparse_scores.max()
    if max_sparse > 0:
        sparse_scores = sparse_scores / max_sparse
    return sparse_scores

def _hybrid_score_matrix(texts_a: List[str], texts_b: List[str],
                         vecs_a: Optional[np.ndarray] = None,
                         vecs_b: Optional[np.ndarray] = None) -> np.ndarray:
    dense_scores = _compute_dense_scores(texts_a, texts_b, vecs_a, vecs_b)
    sparse_scores = _compute_bm25_scores(texts_a, texts_b)
    return DENSE_WEIGHT * dense_scores + BM25_WEIGHT * sparse_scores

def align_documents(chunks_a: List[Dict], chunks_b: List[Dict]) -> List[AlignedPair]:
    import time
    t_start = time.time()

    aligned = []
    used_a = set()
    used_b = set()

    if EXACT_MATCH_ENABLED:
        b_norm_map = {}
        for j, cb in enumerate(chunks_b):
            norm = _normalize_for_exact_match(cb["content"])
            if norm and norm not in b_norm_map:
                b_norm_map[norm] = j

        for i, ca in enumerate(chunks_a):
            norm_a = _normalize_for_exact_match(ca["content"])
            if norm_a and norm_a in b_norm_map:
                j = b_norm_map[norm_a]
                if j not in used_b:
                    aligned.append(AlignedPair(ca, chunks_b[j], score=1.0, method="exact"))
                    used_a.add(i)
                    used_b.add(j)
                    del b_norm_map[norm_a]

        print(f"Phase 0: {len([p for p in aligned if p.method == 'exact'])} exact matches")

    b_article_map = {}
    for j, cb in enumerate(chunks_b):
        if j not in used_b and cb.get("article_number"):
            num = cb["article_number"]
            if num not in b_article_map:
                b_article_map[num] = j

    structural_count = 0
    for i, ca in enumerate(chunks_a):
        if i in used_a:
            continue
        num = ca.get("article_number")
        if num and num in b_article_map:
            j = b_article_map[num]
            if j not in used_b:
                aligned.append(AlignedPair(ca, chunks_b[j], score=1.0, method="structural"))
                used_a.add(i)
                used_b.add(j)
                structural_count += 1

    print(f"Phase 1: {structural_count} structural matches")

    unmatched_a_idx = [i for i in range(len(chunks_a)) if i not in used_a]
    unmatched_b_idx = [j for j in range(len(chunks_b)) if j not in used_b]

    if unmatched_a_idx and unmatched_b_idx:
        texts_a = [chunks_a[i]["embed_text"] for i in unmatched_a_idx]
        texts_b = [chunks_b[j]["embed_text"] for j in unmatched_b_idx]

        vecs_a = None
        vecs_b = None
        if all("_vector" in chunks_a[i] for i in unmatched_a_idx):
            vecs_a = np.array([chunks_a[i]["_vector"] for i in unmatched_a_idx])
        if all("_vector" in chunks_b[j] for j in unmatched_b_idx):
            vecs_b = np.array([chunks_b[j]["_vector"] for j in unmatched_b_idx])

        scores = _hybrid_score_matrix(texts_a, texts_b, vecs_a, vecs_b)

        reranker_scores = None
        if is_reranker_available() and len(texts_a) * len(texts_b) <= 200:
            reranker_scores = rerank_matrix(texts_a, texts_b)
            if reranker_scores is not None:
                scores = 0.7 * scores + 0.3 * reranker_scores
                print(f"Reranker applied to {len(texts_a)}x{len(texts_b)} matrix")

        semantic_count = 0

        if HUNGARIAN_ENABLED:
            try:
                from scipy.optimize import linear_sum_assignment
                cost_matrix = -scores
                row_ind, col_ind = linear_sum_assignment(cost_matrix)

                for local_i, local_j in zip(row_ind, col_ind):
                    if scores[local_i, local_j] >= SIMILARITY_THRESHOLD:
                        global_i = unmatched_a_idx[local_i]
                        global_j = unmatched_b_idx[local_j]
                        if global_j not in used_b:
                            aligned.append(AlignedPair(
                                chunks_a[global_i], chunks_b[global_j],
                                score=float(scores[local_i, local_j]),
                                method="hungarian"
                            ))
                            used_a.add(global_i)
                            used_b.add(global_j)
                            semantic_count += 1

                print(f"Phase 2: {semantic_count} semantic matches (Hungarian)")
            except ImportError:
                print("scipy not installed, falling back to greedy matching")
                HUNGARIAN_FALLBACK = True
        else:
            HUNGARIAN_FALLBACK = True

        if not HUNGARIAN_ENABLED or (locals().get('HUNGARIAN_FALLBACK')):
            for local_i, global_i in enumerate(unmatched_a_idx):
                if global_i in used_a:
                    continue
                best_local_j = int(np.argmax(scores[local_i]))
                best_score = float(scores[local_i][best_local_j])

                if best_score >= SIMILARITY_THRESHOLD:
                    global_j = unmatched_b_idx[best_local_j]
                    if global_j not in used_b:
                        aligned.append(AlignedPair(
                            chunks_a[global_i], chunks_b[global_j],
                            score=best_score, method="greedy"
                        ))
                        used_a.add(global_i)
                        used_b.add(global_j)
                        semantic_count += 1

            print(f"Phase 2: {semantic_count} semantic matches (Greedy)")

    added_count = 0
    deleted_count = 0

    for i, ca in enumerate(chunks_a):
        if i not in used_a:
            aligned.append(AlignedPair(chunk_a=ca, chunk_b=None, method="deleted"))
            deleted_count += 1

    for j, cb in enumerate(chunks_b):
        if j not in used_b:
            aligned.append(AlignedPair(chunk_a=None, chunk_b=cb, method="added"))
            added_count += 1

    print(f"Added: {added_count}, Deleted: {deleted_count}")
    print(f"Alignment completed in {time.time() - t_start:.2f}s")

    def sort_key(pair):
        if pair.chunk_a:
            try:
                return float(pair.chunk_a["clause_no"])
            except (ValueError, TypeError):
                return 9999.0
        try:
            return float(pair.chunk_b["clause_no"])
        except (ValueError, TypeError):
            return 9999.0

    return sorted(aligned, key=sort_key)
