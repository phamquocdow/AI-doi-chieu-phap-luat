import json
from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
QDRANT_LOCAL_PATH = BASE_DIR / "qdrant_data"

COLLECTION_NAME = "legal_chunks_demo"
MODEL_NAME = "BAAI/bge-m3"


def load_chunks():
    chunks_path = DATA_DIR / "chunks.json"
    with open(chunks_path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    chunks = load_chunks()
    if not chunks:
        raise ValueError("Không có dữ liệu trong chunks.json")

    print("Đang load model embedding...")
    model = SentenceTransformer(MODEL_NAME)

    print("Đang tạo embeddings...")
    texts = [c["embed_text"] for c in chunks]
    vectors = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=True,
    )

    vector_size = len(vectors[0])
    print(f"Vector size = {vector_size}")

    client = QdrantClient(path=str(QDRANT_LOCAL_PATH))

    # Xóa collection cũ nếu đã tồn tại
    if client.collection_exists(COLLECTION_NAME):
        client.delete_collection(COLLECTION_NAME)

    print(f"Đang tạo collection: {COLLECTION_NAME}")
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
    )

    points = []
    for idx, (chunk, vector) in enumerate(zip(chunks, vectors), start=1):
        payload = {
            "chunk_id": chunk["chunk_id"],
            "doc_id": chunk["doc_id"],
            "version_id": chunk["version_id"],
            "clause_no": chunk["clause_no"],
            "section_title": chunk["section_title"],
            "content": chunk["content"],
        }
        points.append(
            PointStruct(
                id=idx,
                vector=vector.tolist(),
                payload=payload,
            )
        )

    print("Đang upsert vào Qdrant local...")
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=points,
    )

    print(f"Đã index {len(points)} chunks vào collection '{COLLECTION_NAME}'.")
    print(f"Dữ liệu Qdrant local nằm ở: {QDRANT_LOCAL_PATH}")


if __name__ == "__main__":
    main()