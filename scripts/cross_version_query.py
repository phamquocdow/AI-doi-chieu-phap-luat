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

SOURCE_CHUNK_ID = "A_3"


def load_chunks():
    chunks_path = DATA_DIR / "chunks.json"
    with open(chunks_path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    chunks = load_chunks()
    source = next((x for x in chunks if x["chunk_id"] == SOURCE_CHUNK_ID), None)
    if source is None:
        raise ValueError(f"Không tìm thấy chunk_id = {SOURCE_CHUNK_ID}")

    print(f"Nguồn truy vấn: {source['chunk_id']} - Điều {source['clause_no']} - {source['section_title']}")
    print()

    print("Đang load model embedding...")
    model = SentenceTransformer(MODEL_NAME)
    client = QdrantClient(path=str(QDRANT_LOCAL_PATH))

    query_vector = model.encode(source["embed_text"], normalize_embeddings=True).tolist()

    results = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        query_filter=Filter(
            must=[
                FieldCondition(
                    key="version_id",
                    match=MatchValue(value="B"),
                )
            ]
        ),
        limit=3,
    )

    print("Top kết quả ở bản B:")
    print("-" * 100)

    for i, result in enumerate(results, start=1):
        payload = result.payload
        print(f"{i}. [{payload['version_id']}] Điều {payload['clause_no']} - {payload['section_title']}")
        print(f"   Score: {result.score:.4f}")
        print(f"   Nội dung: {payload['content'][:300].replace(chr(10), ' ')}")
        print()


if __name__ == "__main__":
    main()