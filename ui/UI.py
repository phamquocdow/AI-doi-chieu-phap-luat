import json
import importlib
import locale
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

import streamlit as st


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
SCRIPTS_DIR = BASE_DIR / "scripts"

PIPELINE_STEPS = [
    "parse_chunks.py",
    "build_index.py",
    "align_chunks.py",
    "rerank_alignment.py",
    "sentence_diff.py",
    "extract_evidence.py",
    "apply_guardrail.py",
    "build_comparison_report.py",
]
st.set_page_config(
    page_title="Week 9 - Legal Compare UI",
    page_icon="⚖️",
    layout="wide",
)


def inject_styles() -> None:
    st.markdown(
        """
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;700;800&family=Fraunces:opsz,wght@9..144,700&display=swap');

            :root {
                --bg: #f7f5ef;
                --paper: #fffdf7;
                --ink: #1f2933;
                --muted: #5c6672;
                --brand: #0e7c86;
                --brand-2: #f59e0b;
                --ok: #1d8348;
                --warn: #d97706;
                --danger: #b91c1c;
                --line: #d9d3c3;
                --shadow: 0 12px 36px rgba(17, 24, 39, 0.08);
            }

            html, body, [class*="css"]  {
                font-family: 'Be Vietnam Pro', sans-serif;
                color: var(--ink);
                background: radial-gradient(circle at 12% 10%, #efe8d6 0%, var(--bg) 45%), var(--bg);
            }

            .main .block-container {
                padding-top: 1.2rem;
                max-width: 1200px;
            }

            .hero {
                background:
                    linear-gradient(130deg, rgba(14,124,134,0.92), rgba(16,115,129,0.9) 42%, rgba(245,158,11,0.88));
                border-radius: 18px;
                padding: 26px 28px;
                box-shadow: var(--shadow);
                color: #fff;
                margin-bottom: 1rem;
            }

            .hero h1 {
                margin: 0;
                font-family: 'Fraunces', serif;
                font-size: 2rem;
                letter-spacing: 0.2px;
            }

            .hero p {
                margin: 8px 0 0;
                opacity: 0.96;
                font-size: 1rem;
            }

            .metric-grid {
                display: grid;
                grid-template-columns: repeat(5, minmax(0, 1fr));
                gap: 10px;
                margin: 0.4rem 0 1rem;
            }

            .metric-card {
                border: 1px solid var(--line);
                background: var(--paper);
                border-radius: 14px;
                box-shadow: var(--shadow);
                padding: 12px;
            }

            .metric-card .label {
                color: var(--muted);
                font-size: 0.84rem;
            }

            .metric-card .value {
                font-size: 1.38rem;
                font-weight: 800;
                margin-top: 3px;
            }

            .badge {
                display: inline-block;
                border-radius: 999px;
                padding: 0.24rem 0.62rem;
                font-weight: 700;
                font-size: 0.75rem;
                letter-spacing: 0.2px;
            }

            .b-ok { background: rgba(29,131,72,0.12); color: var(--ok); }
            .b-warn { background: rgba(217,119,6,0.14); color: var(--warn); }
            .b-danger { background: rgba(185,28,28,0.13); color: var(--danger); }
            .b-info { background: rgba(14,124,134,0.12); color: var(--brand); }

            .parallel-box {
                border: 1px solid var(--line);
                border-radius: 14px;
                background: var(--paper);
                box-shadow: var(--shadow);
                padding: 10px;
            }

            .stTextArea textarea {
                border-radius: 12px;
            }

            @media (max-width: 980px) {
                .metric-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .hero h1 {
                    font-size: 1.55rem;
                }
            }
        </style>
        """,
        unsafe_allow_html=True,
    )


def read_text_file(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def save_uploaded_contract(uploaded_file, target_path: Path) -> None:
    content = extract_text_from_uploaded(uploaded_file)
    target_path.write_text(content, encoding="utf-8")


def extract_text_from_uploaded(uploaded_file) -> str:
    suffix = Path(uploaded_file.name).suffix.lower()

    if suffix == ".docx":
        try:
            Document = importlib.import_module("docx").Document
        except ModuleNotFoundError as exc:
            raise RuntimeError("Thiếu gói python-docx. Vui lòng cài requirements trước khi chạy.") from exc
        doc = Document(uploaded_file)
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]
        return "\n".join(paragraphs).strip()

    if suffix == ".pdf":
        try:
            PdfReader = importlib.import_module("pypdf").PdfReader
        except ModuleNotFoundError as exc:
            raise RuntimeError("Thiếu gói pypdf. Vui lòng cài requirements trước khi chạy.") from exc
        reader = PdfReader(uploaded_file)
        pages = []
        for page in reader.pages:
            pages.append((page.extract_text() or "").strip())
        return "\n".join([x for x in pages if x]).strip()

    raise ValueError("Định dạng chưa hỗ trợ. Vui lòng chọn DOCX hoặc PDF.")


def safe_extract(uploaded_file) -> tuple[Optional[str], Optional[str]]:
    try:
        text = extract_text_from_uploaded(uploaded_file)
        if not text:
            return None, "Không đọc được nội dung từ file. Vui lòng kiểm tra lại file tải lên."
        return text, None
    except Exception as exc:
        return None, f"Lỗi đọc file '{uploaded_file.name}': {exc}"


def run_compare_pipeline() -> list[dict]:
    def decode_output(data: bytes | None) -> str:
        if not data:
            return ""

        for enc in ["utf-8", locale.getpreferredencoding(False), "cp1258", "cp1252"]:
            try:
                return data.decode(enc)
            except UnicodeDecodeError:
                continue

        return data.decode("utf-8", errors="replace")

    logs = []
    for step in PIPELINE_STEPS:
        cmd = [sys.executable, step]
        env = dict(os.environ)
        env["PYTHONUTF8"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        proc = subprocess.run(
            cmd,
            cwd=SCRIPTS_DIR,
            capture_output=True,
            text=False,
            env=env,
        )

        stdout_text = decode_output(proc.stdout).strip()
        stderr_text = decode_output(proc.stderr).strip()

        logs.append(
            {
                "step": step,
                "returncode": proc.returncode,
                "stdout": stdout_text,
                "stderr": stderr_text,
            }
        )

        if proc.returncode != 0:
            break

    return logs


def load_report() -> dict:
    report_path = DATA_DIR / "comparison_report.json"
    if not report_path.exists():
        return {}
    return json.loads(report_path.read_text(encoding="utf-8"))


def render_header() -> None:
    st.markdown(
        """
        <div class="hero">
            <h1>Đối chiếu hợp đồng</h1>
            <p>
                Upload hai phiên bản văn bản, xem song song và theo dõi kết quả đối chiếu theo từng điều khoản.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_summary_cards(summary: dict) -> None:
    cards = [
        ("Tổng điều khoản", summary.get("total_clauses_compared", 0)),
        ("Matched", summary.get("matched_clauses", 0)),
        ("Có thay đổi", summary.get("modified_clauses", 0)),
        ("Ít thay đổi", summary.get("unchanged_clauses", 0)),
        ("Bị chặn/thiếu", summary.get("blocked_or_unsupported_clauses", 0)),
    ]

    html = ["<div class='metric-grid'>"]
    for label, value in cards:
        html.append(
            f"""
            <div class='metric-card'>
                <div class='label'>{label}</div>
                <div class='value'>{value}</div>
            </div>
            """
        )
    html.append("</div>")
    st.markdown("\n".join(html), unsafe_allow_html=True)


def format_badge(label: str, klass: str) -> str:
    return f"<span class='badge {klass}'>{label}</span>"


def render_detail_item(item: dict, idx: int) -> None:
    change_type = item.get("clause_change_type", "")
    importance = item.get("importance", "")

    if change_type == "modified":
        change_badge = format_badge("Modified", "b-warn")
    elif change_type == "unchanged":
        change_badge = format_badge("Unchanged", "b-ok")
    else:
        change_badge = format_badge("Blocked", "b-danger")

    importance_class = {
        "high": "b-danger",
        "medium": "b-info",
        "low": "b-ok",
    }.get(importance, "b-info")

    with st.expander(
        f"{idx}. Điều {item.get('source_clause_no')} - {item.get('section_title_a', '')}",
        expanded=False,
    ):
        st.markdown(
            f"{change_badge} &nbsp; {format_badge(f'Importance: {importance}', importance_class)}",
            unsafe_allow_html=True,
        )
        st.write(item.get("summary", ""))

        info_col1, info_col2, info_col3 = st.columns(3)
        info_col1.metric("Alignment score", item.get("final_alignment_score", 0.0))
        info_col2.metric("Alignment status", item.get("alignment_status", ""))
        info_col3.metric("Subtype", item.get("change_subtype", ""))

        text_col1, text_col2 = st.columns(2)
        with text_col1:
            st.markdown("**Phiên bản A**")
            st.text_area(
                f"A_{idx}",
                value=item.get("content_a", ""),
                height=210,
                disabled=True,
                label_visibility="collapsed",
            )
            if item.get("citations_a"):
                st.markdown("Bằng chứng A:")
                for c in item["citations_a"]:
                    st.write(f"- {c}")

        with text_col2:
            st.markdown("**Phiên bản B**")
            st.text_area(
                f"B_{idx}",
                value=item.get("content_b", ""),
                height=210,
                disabled=True,
                label_visibility="collapsed",
            )
            if item.get("citations_b"):
                st.markdown("Bằng chứng B:")
                for c in item["citations_b"]:
                    st.write(f"- {c}")


def main() -> None:
    inject_styles()
    render_header()

    st.sidebar.title("Thiết lập")
    st.sidebar.caption("Upload 2 file DOCX/PDF và chạy pipeline đối chiếu.")

    uploaded_a = st.sidebar.file_uploader(
        "Bản A (.docx, .pdf)",
        type=["docx", "pdf"],
        key="a",
        help="Chỉ hỗ trợ DOCX hoặc PDF.",
    )
    uploaded_b = st.sidebar.file_uploader(
        "Bản B (.docx, .pdf)",
        type=["docx", "pdf"],
        key="b",
        help="Chỉ hỗ trợ DOCX hoặc PDF.",
    )

    run_btn = st.sidebar.button("Chạy đối chiếu", type="primary", use_container_width=True)

    contract_a_text = ""
    contract_b_text = ""
    extract_error = ""

    if uploaded_a is not None:
        a_text, a_err = safe_extract(uploaded_a)
        if a_err:
            extract_error = a_err
        else:
            contract_a_text = a_text or ""

    if uploaded_b is not None:
        b_text, b_err = safe_extract(uploaded_b)
        if b_err and not extract_error:
            extract_error = b_err
        else:
            contract_b_text = b_text or ""

    if extract_error:
        st.error(extract_error)

    st.subheader("Xem song song 2 phiên bản")
    col_a, col_b = st.columns(2)
    with col_a:
        st.markdown("**Văn bản A**")
        st.text_area(
            "contract_a_preview",
            value=contract_a_text if contract_a_text else "Chưa có dữ liệu. Hãy tải file DOCX/PDF cho bản A.",
            height=300,
            disabled=True,
            label_visibility="collapsed",
        )
    with col_b:
        st.markdown("**Văn bản B**")
        st.text_area(
            "contract_b_preview",
            value=contract_b_text if contract_b_text else "Chưa có dữ liệu. Hãy tải file DOCX/PDF cho bản B.",
            height=300,
            disabled=True,
            label_visibility="collapsed",
        )

    if run_btn:
        if uploaded_a is None or uploaded_b is None:
            st.error("Vui lòng tải đủ 2 file DOCX/PDF cho bản A và bản B.")
        elif extract_error:
            st.error("Không thể chạy vì file tải lên chưa hợp lệ.")
        else:
            save_uploaded_contract(uploaded_a, DATA_DIR / "contract_A.txt")
            save_uploaded_contract(uploaded_b, DATA_DIR / "contract_B.txt")

            with st.spinner("Đang chạy pipeline đối chiếu, vui lòng đợi..."):
                logs = run_compare_pipeline()

            failed_steps = [x for x in logs if x["returncode"] != 0]

            if failed_steps:
                st.error(f"Pipeline lỗi tại bước: {failed_steps[0]['step']}")
                for lg in logs:
                    with st.expander(f"Log: {lg['step']} (code={lg['returncode']})"):
                        if lg["stdout"]:
                            st.code(lg["stdout"], language="bash")
                        if lg["stderr"]:
                            st.code(lg["stderr"], language="bash")
            else:
                st.success("Đã chạy xong pipeline và cập nhật báo cáo.")

    report = load_report()
    if not report:
        st.info("Chưa có comparison_report.json. Hãy bấm 'Chạy đối chiếu' để sinh dữ liệu.")
        return

    summary = report.get("summary", {})
    details = report.get("details", [])

    st.subheader("Kết quả theo mục")
    render_summary_cards(summary)

    col_f1, col_f2 = st.columns(2)
    with col_f1:
        chosen_change = st.multiselect(
            "Lọc theo loại thay đổi",
            ["modified", "unchanged"],
            default=["modified", "unchanged"],
        )
    with col_f2:
        chosen_importance = st.multiselect(
            "Lọc theo mức độ ảnh hưởng",
            ["high", "medium", "low"],
            default=["high", "medium", "low"],
        )

    filtered = [
        x
        for x in details
        if x.get("clause_change_type") in chosen_change and x.get("importance") in chosen_importance
    ]

    st.caption(f"Hiển thị {len(filtered)} / {len(details)} điều khoản")

    for idx, item in enumerate(filtered, start=1):
        render_detail_item(item, idx)

    st.divider()
    st.subheader("Bản Markdown đã sinh")
    md_report_path = DATA_DIR / "comparison_report.md"
    md_text = read_text_file(md_report_path)
    st.download_button(
        label="Tải comparison_report.md",
        data=md_text,
        file_name="comparison_report.md",
        mime="text/markdown",
        use_container_width=True,
    )
    st.code(md_text if md_text else "(trống)", language="markdown")


if __name__ == "__main__":
    main()
