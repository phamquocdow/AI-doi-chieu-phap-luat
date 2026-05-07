import json
import hashlib
import threading
from pathlib import Path
from typing import Any, Dict, Optional

from ..config import LLM_CACHE_ENABLED, LLM_CACHE_DIR

_CACHE_FILE = LLM_CACHE_DIR / "llm_cache.json"
_lock = threading.Lock()


class LLMCache:

    def __init__(self, cache_file: Path = _CACHE_FILE):
        self.cache_file = cache_file
        self._store: Dict[str, Any] = self._load()

    def _load(self) -> Dict[str, Any]:
        if self.cache_file.exists():
            try:
                return json.loads(self.cache_file.read_text("utf-8"))
            except (json.JSONDecodeError, OSError):
                return {}
        return {}

    def _save(self) -> None:
        self.cache_file.parent.mkdir(parents=True, exist_ok=True)
        self.cache_file.write_text(
            json.dumps(self._store, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    @staticmethod
    def _key(prompt: str, model: str) -> str:
        raw = f"{model}||{prompt}"
        return hashlib.md5(raw.encode("utf-8")).hexdigest()

    def get(self, prompt: str, model: str) -> Optional[Dict[str, Any]]:
        if not LLM_CACHE_ENABLED:
            return None
        return self._store.get(self._key(prompt, model))

    def set(self, prompt: str, model: str, result: Dict[str, Any]) -> None:
        if not LLM_CACHE_ENABLED:
            return
        with _lock:
            self._store[self._key(prompt, model)] = result
            self._save()

    def clear(self) -> None:
        with _lock:
            self._store.clear()
            self._save()


cache = LLMCache()
