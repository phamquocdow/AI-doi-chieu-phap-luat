import json
import re
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

from ..config import (
    LLM_PROVIDER,
    OLLAMA_BASE_URL,
    LLM_BASE_URL,
    LLM_MODEL,
    LLM_API_KEY,
    LLM_TIMEOUT,
)
from .llm_cache import cache


def _call_ollama_native(
    prompt: str,
    temperature: float = 0.0,
    max_tokens: int = 256,
) -> str:
    """Gọi Ollama /api/generate trực tiếp, bật format: json."""
    url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/generate"
    payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
            "num_ctx": 2048,
        },
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=LLM_TIMEOUT) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body.get("response", "").strip()
    except Exception as exc:
        raise RuntimeError(f"Ollama request failed ({url}): {exc}") from exc


def _call_openai_compatible(
    messages: List[Dict[str, str]],
    temperature: float = 0.0,
    max_tokens: int = 256,
) -> str:
    """Gọi OpenAI-compatible /v1/chat/completions."""
    base = LLM_BASE_URL.rstrip("/")
    url = f"{base}/chat/completions" if base.endswith("/v1") else f"{base}/v1/chat/completions"

    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"}
    }

    headers = {"Content-Type": "application/json"}
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=LLM_TIMEOUT) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            content = body["choices"][0]["message"]["content"]
            return content.strip() if isinstance(content, str) else str(content).strip()
    except Exception as exc:
        raise RuntimeError(f"OpenAI-compatible request failed ({url}): {exc}") from exc


def chat_completion(
    messages: List[Dict[str, str]],
    temperature: float = 0.0,
    max_tokens: int = 256,
    use_cache: bool = True,
    retries: int = 1,
) -> str:
    prompt_text = messages[-1]["content"] if messages else ""
    cache_key = prompt_text

    if use_cache:
        cached = cache.get(cache_key, LLM_MODEL)
        if cached is not None:
            return cached if isinstance(cached, str) else cached.get("_raw", "")

    for attempt in range(retries + 1):
        try:
            if LLM_PROVIDER == "ollama":
                system_parts = [m["content"] for m in messages if m["role"] == "system"]
                user_parts = [m["content"] for m in messages if m["role"] == "user"]
                full_prompt = "\n\n".join(system_parts + user_parts)
                result = _call_ollama_native(full_prompt, temperature, max_tokens)
            else:
                result = _call_openai_compatible(messages, temperature, max_tokens)
                
            # Basic validation to ensure it's at least valid JSON
            if extract_json_object(result) is not None:
                if use_cache and result:
                    cache.set(cache_key, LLM_MODEL, result)
                return result
                
        except Exception as e:
            if attempt == retries:
                raise e
            print(f"LLM Call Failed (Attempt {attempt+1}/{retries+1}). Retrying...")

    return ""


def check_ollama_health() -> bool:
    """Kiểm tra Ollama API có đang chạy không."""
    url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/tags"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=5):
            return True
    except Exception:
        return False


def extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    """Trích xuất JSON object từ LLM response (xử lý think tags & markdown fences)."""
    text = text.strip()
    if not text:
        return None

    text = re.sub(r"<think>[\s\S]*?</think>", "", text).strip()

    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    return None
