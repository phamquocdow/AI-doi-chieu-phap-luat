import re
import math
from typing import List
import numpy as np

_VN_STOPWORDS = frozenset([
    "và", "của", "là", "có", "được", "cho", "các", "này", "trong",
    "với", "theo", "về", "từ", "đến", "không", "một", "những", "để",
    "hoặc", "hay", "do", "bởi", "khi", "nếu", "thì", "đã", "sẽ",
    "đang", "tại", "trên", "dưới", "bên", "như", "cũng", "mà",
    "tuy", "rằng", "vì", "nên", "nhưng",
])

def tokenize(text: str) -> List[str]:
    """Tách từ + loại bỏ stopwords + lowercase."""
    text = re.sub(r"[^\w\s]", " ", text.lower())
    return [w for w in text.split() if w and w not in _VN_STOPWORDS]

class BM25Scorer:

    def __init__(self, corpus_texts: List[str], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus = [tokenize(t) for t in corpus_texts]
        self.n_docs = len(self.corpus)
        self.avgdl = sum(len(d) for d in self.corpus) / max(self.n_docs, 1)
        self.idf = self._compute_idf()

    def _compute_idf(self) -> dict:
        df = {}
        for doc in self.corpus:
            for term in set(doc):
                df[term] = df.get(term, 0) + 1

        idf = {}
        for term, freq in df.items():
            idf[term] = math.log((self.n_docs - freq + 0.5) / (freq + 0.5) + 1.0)
        return idf

    def _score_single(self, query_tokens: List[str], doc_idx: int) -> float:
        doc = self.corpus[doc_idx]
        doc_len = len(doc)

        tf = {}
        for term in doc:
            tf[term] = tf.get(term, 0) + 1

        score = 0.0
        for q_term in query_tokens:
            if q_term not in self.idf:
                continue
            term_tf = tf.get(q_term, 0)
            numerator = self.idf[q_term] * term_tf * (self.k1 + 1)
            denominator = term_tf + self.k1 * (1 - self.b + self.b * doc_len / self.avgdl)
            score += numerator / denominator

        return score

    def score(self, query: str) -> np.ndarray:
        q_tokens = tokenize(query)
        if not q_tokens or not self.corpus:
            return np.zeros(self.n_docs)
        return np.array([self._score_single(q_tokens, i) for i in range(self.n_docs)])
