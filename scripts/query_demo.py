from pathlib import Path

from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer

BASE_DIR = Path(__file__).resolve().parents[1]
QDRANT_LOCAL_PATH = BASE_DIR / "qdrant_data"

COLLECTION_NAME = "legal_chunks_demo"
MODEL_NAME = "BAAI/bge-m3"

QUERIES = [
    "thời giờ làm việc",
    "mức lương",
    "bảo mật thông tin",
    "tranh chấp lao động",
]


def print_result(result, rank: int):
    payload = result.payload
    score = result.score
    print(f"{rank}. [{payload['version_id']}] Điều {payload['clause_no']} - {payload['section_title']}")
    print(f"   Score: {score:.4f}")
    print(f"   Nội dung: {payload['content'][:300].replace(chr(10), ' ')}")
    print()


def main():
    print("Đang load model embedding...")
    model = SentenceTransformer(MODEL_NAME)
    client = QdrantClient(path=str(QDRANT_LOCAL_PATH))

    for query in QUERIES:
        print("=" * 100)
        print(f"QUERY: {query}")
        print("=" * 100)

        query_vector = model.encode(query, normalize_embeddings=True).tolist()

        results = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=3,
        )

        for i, result in enumerate(results, start=1):
            print_result(result, i)


if __name__ == "__main__":
    main()