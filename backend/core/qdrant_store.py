import os
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from sentence_transformers import SentenceTransformer
from ..config import DATA_DIR, EMBED_MODEL, EMBED_DEVICE, BATCH_SIZE, TOP_K
import uuid
QDRANT_LOCAL_PATH = DATA_DIR / "qdrant_data"
COLLECTION_NAME = "legal_chunks_demo"
class VectorStore:
    def __init__(self):
        self.client = QdrantClient(path=str(QDRANT_LOCAL_PATH))
        self.model = None

    def _load_model(self):
        if self.model is None:
            self.model = SentenceTransformer(EMBED_MODEL, device=EMBED_DEVICE)
        return self.model

    def add_chunks(self, doc_id: str, chunks: list):
        model = self._load_model()
        texts = [c["embed_text"] for c in chunks]
        vectors = model.encode(texts, batch_size=BATCH_SIZE, normalize_embeddings=True)
        vector_size = len(vectors[0])

        if not self.client.collection_exists(COLLECTION_NAME):
            self.client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
            )

        self.client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
            )
        )

        points = []

        for chunk, vector in zip(chunks, vectors):
            payload = {
                "chunk_id": chunk.get("chunk_id", str(uuid.uuid4())),
                "doc_id": doc_id,
                "clause_no": chunk.get("clause_no", ""),
                "article_number": chunk.get("article_number", ""),
                "section_title": chunk.get("section_title", ""),
                "content": chunk.get("content", ""),
                "embed_text": chunk.get("embed_text", ""),
            }
            points.append(
                PointStruct(id=str(uuid.uuid4()), vector=vector.tolist(), payload=payload)
            )

        if points:
            self.client.upsert(collection_name=COLLECTION_NAME, points=points)

    def get_chunks_by_doc_id(self, doc_id: str) -> list:

        results, _ = self.client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=Filter(
                must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
            ),
            limit=1000,
            with_payload=True,
        )

        chunks = []
        for r in results:
            chunks.append(r.payload)
        return chunks

vector_store = VectorStore()
