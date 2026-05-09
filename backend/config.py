import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# --- LLM Provider ---
# "ollama" = gọi native Ollama /api/generate
# "openai" = gọi OpenAI-compatible /v1/chat/completions
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")

# --- Ollama Native Config ---
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen3:1.7b")
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "120"))
LLM_MAX_WORKERS = int(os.getenv("LLM_MAX_WORKERS", "3"))

# --- OpenAI-Compatible Config (fallback) ---
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")

# --- LLM Cache ---
LLM_CACHE_ENABLED = os.getenv("LLM_CACHE_ENABLED", "true").lower() == "true"
LLM_CACHE_DIR = DATA_DIR / "cache"
LLM_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# --- Embedding ---
EMBED_MODEL = os.getenv("EMBED_MODEL", "BAAI/bge-m3")
EMBED_DEVICE = os.getenv("EMBED_DEVICE", "cpu")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "32"))
TOP_K = int(os.getenv("TOP_K", "5"))

# --- Hybrid Retrieval Weights ---
DENSE_WEIGHT = float(os.getenv("DENSE_WEIGHT", "0.7"))
BM25_WEIGHT = float(os.getenv("BM25_WEIGHT", "0.3"))

# --- Reranker (Cross-encoder) ---
RERANKER_ENABLED = os.getenv("RERANKER_ENABLED", "true").lower() == "true"
RERANKER_MODEL = os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
RERANKER_THRESHOLD = float(os.getenv("RERANKER_THRESHOLD", "0.5"))

# --- Matching ---
HUNGARIAN_ENABLED = os.getenv("HUNGARIAN_ENABLED", "true").lower() == "true"
EXACT_MATCH_ENABLED = os.getenv("EXACT_MATCH_ENABLED", "true").lower() == "true"

# --- Chunking ---
MIN_CHUNK_CHARS = int(os.getenv("MIN_CHUNK_CHARS", "80"))
MAX_CHUNK_CHARS = int(os.getenv("MAX_CHUNK_CHARS", "2000"))
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.5"))
MAX_CHUNKS_PER_DOC = int(os.getenv("MAX_CHUNKS_PER_DOC", "30"))
