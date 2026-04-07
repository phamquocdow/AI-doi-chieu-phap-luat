import json
from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from sentence_transformers import SentenceTransformer

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
QDRANT_LOCAL_PATH = BASE_DIR / "qdrant_data"

COLLECTION_NAME = "legal_chunks_demo"
MODEL_NAME = "BAAI/bge-m3"
TOP_K = 5


def load_chunks():
    with open(DATA_DIR / "chunks.json", "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    chunks = load_chunks()
    chunks_a = [x for x in chunks if x["version_id"] == "A"]

    print("Đang load model embedding...")
    model = SentenceTransformer(MODEL_NAME)
    client = QdrantClient(path=str(QDRANT_LOCAL_PATH))

    all_candidates = []

    for chunk_a in chunks_a:
        query_vector = model.encode(
            chunk_a["embed_text"],
            normalize_embeddings=True
        ).tolist()

        results = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            query_filter=Filter(
                must=[FieldCondition(key="version_id", match=MatchValue(value="B"))]
            ),
            limit=TOP_K,
        )

        candidates = []
        for r in results:
            candidates.append(
                {
                    "target_chunk_id": r.payload["chunk_id"],
                    "target_clause_no": str(r.payload["clause_no"]),
                    "target_section_title": r.payload["section_title"],
                    "embedding_score": round(float(r.score), 6),
                }
            )

        all_candidates.append(
            {
                "source_chunk_id": chunk_a["chunk_id"],
                "source_clause_no": str(chunk_a["clause_no"]),
                "source_section_title": chunk_a["section_title"],
                "candidates": candidates,
            }
        )

    output_path = DATA_DIR / "alignment_candidates.json"
    output_path.write_text(
        json.dumps(all_candidates, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print(f"Đã lưu ứng viên retrieval vào: {output_path}")


if __name__ == "__main__":
    main()