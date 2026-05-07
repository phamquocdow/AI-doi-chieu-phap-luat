import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any

from ..core.bm25_scorer import BM25Scorer
from ..config import EMBED_MODEL, EMBED_DEVICE, DENSE_WEIGHT, BM25_WEIGHT, SIMILARITY_THRESHOLD

_embedder = None

def _get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBED_MODEL, device=EMBED_DEVICE)
    return _embedder

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

def _hybrid_score_matrix(texts_a: List[str], texts_b: List[str]) -> np.ndarray:
    embedder = _get_embedder()
    vecs_a = embedder.encode(texts_a, normalize_embeddings=True)
    vecs_b = embedder.encode(texts_b, normalize_embeddings=True)
    dense_scores = np.dot(vecs_a, vecs_b.T)

    bm25 = BM25Scorer(texts_b)
    sparse_scores = np.array([bm25.score(t) for t in texts_a])

    max_sparse = sparse_scores.max()
    if max_sparse > 0:
        sparse_scores = sparse_scores / max_sparse

    return DENSE_WEIGHT * dense_scores + BM25_WEIGHT * sparse_scores

def align_documents(chunks_a: List[Dict], chunks_b: List[Dict]) -> List[AlignedPair]:
    aligned = []
    
    used_a = set()
    used_b = set()
    
    b_map = {cb["article_number"]: i for i, cb in enumerate(chunks_b) if cb["article_number"]}
    
    for i, ca in enumerate(chunks_a):
        num = ca["article_number"]
        if num and num in b_map:
            j = b_map[num]
            if j not in used_b:
                aligned.append(AlignedPair(ca, chunks_b[j], score=1.0, method="structural"))
                used_a.add(i)
                used_b.add(j)
                
    unmatched_a_idx = [i for i in range(len(chunks_a)) if i not in used_a]
    unmatched_b_idx = [j for j in range(len(chunks_b)) if j not in used_b]
    
    if unmatched_a_idx and unmatched_b_idx:
        texts_a = [chunks_a[i]["embed_text"] for i in unmatched_a_idx]
        texts_b = [chunks_b[j]["embed_text"] for j in unmatched_b_idx]
        
        scores = _hybrid_score_matrix(texts_a, texts_b)
        
        for local_i, global_i in enumerate(unmatched_a_idx):
            best_local_j = int(np.argmax(scores[local_i]))
            best_score = float(scores[local_i][best_local_j])
            
            if best_score >= SIMILARITY_THRESHOLD:
                global_j = unmatched_b_idx[best_local_j]
                if global_j not in used_b:
                    aligned.append(AlignedPair(chunks_a[global_i], chunks_b[global_j], score=best_score, method="semantic"))
                    used_a.add(global_i)
                    used_b.add(global_j)
                    
    for i, ca in enumerate(chunks_a):
        if i not in used_a:
            aligned.append(AlignedPair(chunk_a=ca, chunk_b=None, method="deleted"))
            
    for j, cb in enumerate(chunks_b):
        if j not in used_b:
            aligned.append(AlignedPair(chunk_a=None, chunk_b=cb, method="added"))
            
    def sort_key(pair):
        if pair.chunk_a:
            try: return float(pair.chunk_a["clause_no"])
            except ValueError: return 9999.0
        try: return float(pair.chunk_b["clause_no"])
        except ValueError: return 9999.0
        
    return sorted(aligned, key=sort_key)
