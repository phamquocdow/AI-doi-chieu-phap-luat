import time
import os
import json
import uuid
import shutil
import traceback
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from .config import LLM_MODEL, LLM_PROVIDER, DATA_DIR, RERANKER_ENABLED
from .core.document_parser import extract_text_from_file, smart_split
from .core.llm_client import check_ollama_health
from .core.qdrant_store import vector_store
from .core.pdf_converter import convert_to_pdf
from .pipeline.quick_compare import run_quick_compare
from .pipeline.llm_compare import run_llm_compare_from_chunks

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Preloading embedding model...")
    from .core.embedding_manager import get_embedder
    get_embedder()
    
    if RERANKER_ENABLED:
        print("Preloading reranker model...")
        from .core.reranker import _load_reranker
        _load_reranker()
    yield

app = FastAPI(title="Legal Compare API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_DIR = DATA_DIR / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Nơi lưu các cuộc trò chuyện (mỗi cuộc = 1 thư mục chứa meta.json + bản chụp PDF)
CONV_DIR = DATA_DIR / "conversations"
CONV_DIR.mkdir(parents=True, exist_ok=True)

GREETING = "Xin chào! Tôi là trợ lý pháp lý AI. Bạn có thắc mắc gì về những điểm thay đổi trong tài liệu này không?"

SESSION_STATE = {
    "file_1": None,
    "file_2": None,
    "latest_report": None,
    "conversation_id": None,
}


# ── Conversation store ───────────────────────────────────────────────────────
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _conv_meta_path(conv_id: str) -> Path:
    return CONV_DIR / conv_id / "meta.json"


def _load_conv(conv_id: str):
    if not conv_id:
        return None
    p = _conv_meta_path(conv_id)
    if not p.exists():
        return None
    try:
        with p.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _save_conv(conv: dict) -> None:
    d = CONV_DIR / conv["id"]
    d.mkdir(parents=True, exist_ok=True)
    with (d / "meta.json").open("w", encoding="utf-8") as f:
        json.dump(conv, f, ensure_ascii=False, indent=2)


def _list_convs() -> list:
    items = []
    for d in CONV_DIR.iterdir():
        if not d.is_dir():
            continue
        meta = d / "meta.json"
        if not meta.exists():
            continue
        try:
            with meta.open("r", encoding="utf-8") as f:
                c = json.load(f)
            items.append({
                "id": c["id"],
                "title": c.get("title", "Cuộc trò chuyện"),
                "created_at": c.get("created_at"),
                "updated_at": c.get("updated_at"),
                "message_count": len(c.get("messages", [])),
            })
        except Exception:
            continue
    items.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return items


def _create_conversation(report: dict, duration_sec, file1_name, file2_name) -> dict:
    conv_id = uuid.uuid4().hex[:12]
    d = CONV_DIR / conv_id
    d.mkdir(parents=True, exist_ok=True)

    # Chụp lại PDF của 2 slot (file gốc sẽ bị ghi đè khi upload lần sau)
    pdf_urls = {}
    for slot in ("file_1", "file_2"):
        src = CACHE_DIR / f"{slot}.pdf"
        if src.exists():
            shutil.copyfile(src, d / f"{slot}.pdf")
            pdf_urls[slot] = f"/api/conversations/{conv_id}/pdf/{slot}"
        else:
            pdf_urls[slot] = None

    title = " ↔ ".join([x for x in [file1_name, file2_name] if x]) or "Cuộc trò chuyện mới"
    conv = {
        "id": conv_id,
        "title": title,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "report": report,
        "duration_sec": duration_sec,
        "pdf_url_a": pdf_urls.get("file_1"),
        "pdf_url_b": pdf_urls.get("file_2"),
        "file1_name": file1_name,
        "file2_name": file2_name,
        "messages": [{"role": "ai", "content": GREETING}],
    }
    _save_conv(conv)
    return conv

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    slot: str = Query(...)
):
    if slot not in ["file_1", "file_2"]:
        raise HTTPException(status_code=400, detail="Slot không hợp lệ")

    if slot == "file_2" and not SESSION_STATE.get("file_1"):
        raise HTTPException(status_code=409, detail="Cần upload file 1 trước")

    if slot == "file_1":
        SESSION_STATE["file_1"] = None
        SESSION_STATE["file_2"] = None

    file_ext = Path(file.filename).suffix.lower()
    temp_path = CACHE_DIR / f"upload_{slot}{file_ext}"
    pdf_path = CACHE_DIR / f"{slot}.pdf"

    # Xoá toàn bộ cache cũ của slot này (PDF đã convert + mọi file upload tạm với
    # đuôi khác) để lần upload mới không bị phục vụ lại PDF của file trước.
    pdf_path.unlink(missing_ok=True)
    for stale in CACHE_DIR.glob(f"upload_{slot}.*"):
        stale.unlink(missing_ok=True)

    with temp_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    with temp_path.open("rb") as f:
        file_bytes = f.read()
    
    text = extract_text_from_file(file.filename, file_bytes)
    if not text:
        raise HTTPException(status_code=400, detail="Không thể trích xuất văn bản từ file")

    chunks = smart_split(text)

    vector_store.add_chunks(doc_id=slot, chunks=chunks)

    pdf_available = False
    try:
        convert_to_pdf(temp_path, pdf_path)
        pdf_available = pdf_path.exists()
    except Exception as e:
        print(f"Warning: PDF conversion failed: {e}")
        # Convert thất bại: đảm bảo không còn PDF cũ sót lại để phục vụ nhầm.
        pdf_path.unlink(missing_ok=True)

    SESSION_STATE[slot] = {
        "filename": file.filename,
        "chunk_count": len(chunks),
        "pdf_available": pdf_available
    }

    return {
        "success": True,
        "slot": slot,
        "message": f"Upload và xử lý {slot} thành công",
        "pdf_url": f"/api/documents/{slot}/pdf" if pdf_available else None
    }


@app.get("/api/documents/{slot}/pdf")
async def get_pdf(slot: str):
    pdf_path = CACHE_DIR / f"{slot}.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy PDF")
    return FileResponse(
        pdf_path, 
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={slot}.pdf"}
    )


@app.post("/api/compare")
async def compare_documents():
    if not SESSION_STATE.get("file_1") or not SESSION_STATE.get("file_2"):
        raise HTTPException(status_code=400, detail="Cần upload đủ 2 file trước khi so sánh")

    start_time = time.time()

    try:
        chunks_a = vector_store.get_chunks_by_doc_id("file_1", with_vectors=True)
        chunks_b = vector_store.get_chunks_by_doc_id("file_2", with_vectors=True)

        if not chunks_a or not chunks_b:
            raise HTTPException(status_code=400, detail="Không tìm thấy dữ liệu vector. Vui lòng upload lại.")

        print(f"\nStarting comparison: {len(chunks_a)} vs {len(chunks_b)} chunks")
        report = run_llm_compare_from_chunks(chunks_a, chunks_b)

        SESSION_STATE["latest_report"] = report

        duration = round(time.time() - start_time, 2)

        # Tự động tạo một cuộc trò chuyện mới cho lần so sánh này
        f1 = (SESSION_STATE.get("file_1") or {}).get("filename")
        f2 = (SESSION_STATE.get("file_2") or {}).get("filename")
        conv = _create_conversation(report, duration, f1, f2)
        SESSION_STATE["conversation_id"] = conv["id"]

        return {
            "success": True,
            "duration_sec": duration,
            "report": report,
            "conversation_id": conv["id"],
            "title": conv["title"],
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Conversation endpoints ───────────────────────────────────────────────────
@app.get("/api/conversations")
def list_conversations():
    return {"conversations": _list_convs()}


@app.get("/api/conversations/{conv_id}")
def get_conversation(conv_id: str):
    conv = _load_conv(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện")
    SESSION_STATE["conversation_id"] = conv_id
    SESSION_STATE["latest_report"] = conv.get("report")
    return conv


@app.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str):
    d = CONV_DIR / conv_id
    if d.exists():
        shutil.rmtree(d, ignore_errors=True)
    if SESSION_STATE.get("conversation_id") == conv_id:
        SESSION_STATE["conversation_id"] = None
    return {"success": True}


class RenameRequest(BaseModel):
    title: str

@app.patch("/api/conversations/{conv_id}")
def rename_conversation(conv_id: str, req: RenameRequest):
    conv = _load_conv(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện")
    conv["title"] = req.title.strip() or conv["title"]
    conv["updated_at"] = _now_iso()
    _save_conv(conv)
    return {"success": True, "title": conv["title"]}


@app.get("/api/conversations/{conv_id}/pdf/{slot}")
def get_conversation_pdf(conv_id: str, slot: str):
    if slot not in ("file_1", "file_2"):
        raise HTTPException(status_code=400, detail="Slot không hợp lệ")
    pdf_path = CONV_DIR / conv_id / f"{slot}.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy PDF")
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={slot}.pdf"},
    )


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

@app.post("/api/chat")
async def chat_with_report(req: ChatRequest):
    # Ưu tiên ngữ cảnh báo cáo của cuộc trò chuyện được chỉ định; nếu không có thì
    # dùng báo cáo mới nhất trong phiên (tương thích ngược).
    conv = _load_conv(req.conversation_id) if req.conversation_id else None
    report = conv.get("report") if conv else SESSION_STATE.get("latest_report")
    if not report:
        raise HTTPException(status_code=400, detail="Chưa có kết quả so sánh để hỏi đáp.")

    details = report.get("details", [])
    changes = [item for item in details if item.get("clause_change_type") in ["modified", "added", "deleted"]]

    context_lines = []
    for item in changes:
        title = item.get("section_title_a") or item.get("section_title_b") or "Đoạn văn"
        summary = item.get("summary", "")
        context_lines.append(f"- {title}: {summary}")

    context_str = "\n".join(context_lines)
    if not context_str:
        context_str = "Không có thay đổi nào giữa hai văn bản."

    system_content = (
        "Bạn là trợ lý pháp lý khách quan, tư vấn dựa trên dữ liệu so sánh được cung cấp. "
        "Hãy trả lời dựa vào danh sách các điểm thay đổi giữa hai văn bản dưới đây "
        "(KHÔNG dùng kiến thức bên ngoài nếu không chắc chắn).\n\n"
        f"DANH SÁCH THAY ĐỔI:\n{context_str}"
    )

    # Dựng hội thoại nhiều lượt: system + các lượt trước + câu hỏi mới
    messages = [{"role": "system", "content": system_content}]
    if conv:
        for m in conv.get("messages", []):
            role = "assistant" if m.get("role") == "ai" else "user"
            content = m.get("content", "")
            if content:
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": req.message})

    # Lưu ngay câu hỏi của người dùng vào cuộc trò chuyện
    if conv:
        conv.setdefault("messages", []).append({"role": "user", "content": req.message})
        conv["updated_at"] = _now_iso()
        _save_conv(conv)

    from .core.llm_client import stream_chat_completion

    def generate():
        full = ""
        for chunk in stream_chat_completion(messages, temperature=0.1):
            full += chunk
            yield chunk
        # Khi stream xong, lưu câu trả lời của AI để giữ lịch sử
        if conv:
            conv.setdefault("messages", []).append({"role": "ai", "content": full})
            conv["updated_at"] = _now_iso()
            _save_conv(conv)

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/api/health")
def health_check():
    ollama_ok = check_ollama_health()
    return {
        "status": "ok",
        "ollama": "connected" if ollama_ok else "disconnected",
        "model": LLM_MODEL,
        "provider": LLM_PROVIDER,
    }
