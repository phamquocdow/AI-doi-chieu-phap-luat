import time
import os
import shutil
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from .config import LLM_MODEL, LLM_PROVIDER, DATA_DIR
from .core.document_parser import extract_text_from_file, smart_split
from .core.llm_client import check_ollama_health
from .core.qdrant_store import vector_store
from .core.pdf_converter import convert_to_pdf
from .pipeline.quick_compare import run_quick_compare
from .pipeline.llm_compare import run_llm_compare_from_chunks

app = FastAPI(title="Legal Compare API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_DIR = DATA_DIR / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Giả lập state session đơn giản trong memory (Cho 1 user/session)
SESSION_STATE = {
    "file_1": None,
    "file_2": None,
    "latest_report": None,
}

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    slot: str = Query(...)  # "file_1" hoặc "file_2"
):
    if slot not in ["file_1", "file_2"]:
        raise HTTPException(status_code=400, detail="Slot không hợp lệ")

    if slot == "file_2" and not SESSION_STATE.get("file_1"):
        raise HTTPException(status_code=409, detail="Cần upload file 1 trước")

    if slot == "file_1":
        # Reset file 2 if uploading file 1 again
        SESSION_STATE["file_1"] = None
        SESSION_STATE["file_2"] = None

    file_ext = Path(file.filename).suffix.lower()
    temp_path = CACHE_DIR / f"upload_{slot}{file_ext}"
    pdf_path = CACHE_DIR / f"{slot}.pdf"

    # Save uploaded file
    with temp_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 1. Trích xuất Text
    with temp_path.open("rb") as f:
        file_bytes = f.read()
    
    text = extract_text_from_file(file.filename, file_bytes)
    if not text:
        raise HTTPException(status_code=400, detail="Không thể trích xuất văn bản từ file")

    # 2. Chunking
    chunks = smart_split(text)

    # 3. Embedding -> Qdrant
    vector_store.add_chunks(doc_id=slot, chunks=chunks)

    # 4. Convert to PDF for Preview
    try:
        convert_to_pdf(temp_path, pdf_path)
    except Exception as e:
        print(f"Warning: PDF conversion failed: {e}")
        # Dù lỗi cũng không break luồng chính, nhưng ko có preview
    
    SESSION_STATE[slot] = {
        "filename": file.filename,
        "chunk_count": len(chunks),
        "pdf_available": pdf_path.exists()
    }

    return {
        "success": True,
        "slot": slot,
        "message": f"Upload và xử lý {slot} thành công",
        "pdf_url": f"/api/documents/{slot}/pdf" if pdf_path.exists() else None
    }


@app.get("/api/documents/{slot}/pdf")
async def get_pdf(slot: str):
    pdf_path = CACHE_DIR / f"{slot}.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy PDF")
    # Không truyền filename để trình duyệt hiển thị inline (không bị force download)
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
        chunks_a = vector_store.get_chunks_by_doc_id("file_1")
        chunks_b = vector_store.get_chunks_by_doc_id("file_2")

        if not chunks_a or not chunks_b:
            raise HTTPException(status_code=400, detail="Không tìm thấy dữ liệu vector. Vui lòng upload lại.")

        report = run_llm_compare_from_chunks(chunks_a, chunks_b)
        
        SESSION_STATE["latest_report"] = report

        duration = time.time() - start_time

        return {
            "success": True,
            "duration_sec": round(duration, 2),
            "report": report,
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
async def chat_with_report(req: ChatRequest):
    report = SESSION_STATE.get("latest_report")
    if not report:
        raise HTTPException(status_code=400, detail="Chưa có kết quả so sánh để hỏi đáp.")
    
    # Filter modified, added, deleted
    details = report.get("details", [])
    changes = [item for item in details if item.get("clause_change_type") in ["modified", "added", "deleted"]]
    
    # Build context string
    context_lines = []
    for item in changes:
        title = item.get("section_title_a") or item.get("section_title_b") or "Đoạn văn"
        summary = item.get("summary", "")
        context_lines.append(f"- {title}: {summary}")
    
    context_str = "\n".join(context_lines)
    if not context_str:
        context_str = "Không có thay đổi nào giữa hai văn bản."
    
    prompt = f"""Bạn là trợ lý pháp lý chuyên nghiệp. Hãy trả lời câu hỏi của người dùng dựa vào danh sách các điểm thay đổi giữa hai văn bản dưới đây (KHÔNG dùng kiến thức bên ngoài nếu không chắc chắn).
    
DANH SÁCH THAY ĐỔI:
{context_str}

CÂU HỎI CỦA NGƯỜI DÙNG: {req.message}
"""
    messages = [
        {"role": "system", "content": "Bạn là trợ lý pháp lý khách quan, tư vấn dựa trên dữ liệu so sánh được cung cấp."},
        {"role": "user", "content": prompt}
    ]
    
    from .core.llm_client import stream_chat_completion
    return StreamingResponse(stream_chat_completion(messages, temperature=0.1), media_type="text/event-stream")


@app.get("/api/health")
def health_check():
    ollama_ok = check_ollama_health()
    return {
        "status": "ok",
        "ollama": "connected" if ollama_ok else "disconnected",
        "model": LLM_MODEL,
        "provider": LLM_PROVIDER,
    }