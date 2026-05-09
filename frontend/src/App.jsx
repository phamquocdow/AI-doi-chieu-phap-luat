import React, { useState } from 'react';
import axios from 'axios';
import { Layers, Activity, FileText, CheckCircle2, Shield, Cpu, BookOpen } from 'lucide-react';
import Uploader from './components/Uploader';
import ReportView from './components/ReportView';

function App() {
  const [file1Status, setFile1Status] = useState({ uploading: false, done: false, pdf_url: null, filename: null });
  const [file2Status, setFile2Status] = useState({ uploading: false, done: false, pdf_url: null, filename: null });
  const [comparing, setComparing] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const handleUpload = async (file, slot) => {
    if (!file) return;
    setError('');
    if (slot === 'file_1') setFile1Status({ uploading: true, done: false, pdf_url: null, filename: null });
    else setFile2Status({ uploading: true, done: false, pdf_url: null, filename: null });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`http://localhost:8000/api/documents/upload?slot=${slot}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) {
        if (slot === 'file_1') {
          setFile1Status({ uploading: false, done: true, pdf_url: response.data.pdf_url, filename: file.name });
          setFile2Status({ uploading: false, done: false, pdf_url: null, filename: null });
        } else {
          setFile2Status({ uploading: false, done: true, pdf_url: response.data.pdf_url, filename: file.name });
        }
      } else {
        throw new Error(response.data.detail || 'Lỗi upload');
      }
    } catch (err) {
      if (slot === 'file_1') setFile1Status({ uploading: false, done: false, pdf_url: null, filename: null });
      else setFile2Status({ uploading: false, done: false, pdf_url: null, filename: null });
      setError(err.response?.data?.detail || err.message || 'Lỗi kết nối đến server.');
    }
  };

  const handleCompare = async () => {
    if (!file1Status.done || !file2Status.done) {
      setError('Vui lòng upload hoàn tất cả 2 file để so sánh.');
      return;
    }
    setComparing(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:8000/api/compare');
      if (response.data.success) {
        setReport({ ...response.data, pdf_url_a: file1Status.pdf_url, pdf_url_b: file2Status.pdf_url });
      } else {
        setError('Có lỗi xảy ra trong quá trình so sánh.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Lỗi kết nối đến server.');
    } finally {
      setComparing(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setFile1Status({ uploading: false, done: false, pdf_url: null, filename: null });
    setFile2Status({ uploading: false, done: false, pdf_url: null, filename: null });
    setError('');
  };

  return (
    <div className="lc-root">
      {/* ── Top nav ── */}
      <header className="lc-nav">
        <div className="lc-nav-inner">
          <div className="lc-brand">
            <div className="lc-brand-icon">
              <Layers size={22} color="#fff" />
            </div>
            <div>
              <span className="lc-brand-name">LegalCompare</span>
              <span className="lc-brand-tag">AI</span>
            </div>
          </div>
          <div className="lc-nav-pills">
            <span className="lc-pill"><Shield size={13} /> Offline</span>
            <span className="lc-pill"><Cpu size={13} /> Local LLM</span>
          </div>
        </div>
      </header>

      <main className="lc-main">
        {!report ? (
          <>
            {/* Hero */}
            <section className="lc-hero">
              <div className="lc-hero-badge">
                <BookOpen size={14} />
                Nghiên cứu RAG + Local LLM
              </div>
              <h1 className="lc-hero-title">
                Đối chiếu văn bản<br />
                <span className="lc-hero-accent">pháp lý thông minh</span>
              </h1>
              <p className="lc-hero-sub">
                Phát hiện thay đổi điều khoản, tóm tắt sự khác biệt và trích dẫn bằng chứng — tất cả chạy cục bộ, bảo mật tuyệt đối.
              </p>
            </section>

            {/* Upload panel */}
            <div className="lc-card lc-upload-card">
              <div className="lc-card-header">
                <FileText size={20} className="lc-card-header-icon" />
                <h2 className="lc-card-title">Tải lên tài liệu so sánh</h2>
                <span className="lc-step-hint">Tải lần lượt Bản cũ → Bản mới</span>
              </div>

              <div className="lc-upload-grid">
                {/* File 1 */}
                <div className={`lc-slot lc-slot-a ${file1Status.done ? 'lc-slot-done' : ''}`}>
                  <div className="lc-slot-label">
                    <span className="lc-slot-num lc-slot-num-a">1</span>
                    <span>Bản cũ</span>
                    {file1Status.done && <CheckCircle2 size={16} className="lc-check" />}
                  </div>
                  {!file1Status.done ? (
                    <Uploader
                      label="Chọn File 1 (DOCX / PDF)"
                      disabled={file1Status.uploading}
                      onFileChange={(f) => handleUpload(f, 'file_1')}
                      iconColor="#1d4ed8"
                    />
                  ) : (
                    <div className="lc-uploaded-box">
                      <div className="lc-uploaded-name">
                        <FileText size={15} />
                        <span>{file1Status.filename}</span>
                        <button className="lc-remove-btn" onClick={() => setFile1Status({ uploading: false, done: false, pdf_url: null, filename: null })}>Xóa</button>
                      </div>
                      {file1Status.pdf_url && (
                        <div className="lc-pdf-preview lc-pdf-preview-a">
                          <iframe src={`http://localhost:8000${file1Status.pdf_url}`} width="100%" height="100%" style={{ border: 'none', background: '#fff' }} title="PDF 1" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="lc-slot-divider">
                  <div className="lc-divider-line" />
                  <span className="lc-divider-label">vs</span>
                  <div className="lc-divider-line" />
                </div>

                {/* File 2 */}
                <div className={`lc-slot lc-slot-b ${!file1Status.done ? 'lc-slot-locked' : ''} ${file2Status.done ? 'lc-slot-done' : ''}`}>
                  <div className="lc-slot-label">
                    <span className={`lc-slot-num ${file1Status.done ? 'lc-slot-num-b' : 'lc-slot-num-locked'}`}>2</span>
                    <span>Bản mới</span>
                    {file2Status.done && <CheckCircle2 size={16} className="lc-check" />}
                  </div>
                  {!file2Status.done ? (
                    <Uploader
                      label={file1Status.done ? 'Chọn File 2 (DOCX / PDF)' : 'Chờ xử lý xong File 1'}
                      disabled={file2Status.uploading || !file1Status.done}
                      onFileChange={(f) => handleUpload(f, 'file_2')}
                      iconColor={file1Status.done ? '#0369a1' : '#94a3b8'}
                    />
                  ) : (
                    <div className="lc-uploaded-box">
                      <div className="lc-uploaded-name">
                        <FileText size={15} />
                        <span>{file2Status.filename}</span>
                        <button className="lc-remove-btn" onClick={() => setFile2Status({ uploading: false, done: false, pdf_url: null, filename: null })}>Xóa</button>
                      </div>
                      {file2Status.pdf_url && (
                        <div className="lc-pdf-preview lc-pdf-preview-b">
                          <iframe src={`http://localhost:8000${file2Status.pdf_url}`} width="100%" height="100%" style={{ border: 'none', background: '#fff' }} title="PDF 2" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="lc-error">
                  {error}
                </div>
              )}

              <div className="lc-compare-row">
                <button
                  className={`lc-compare-btn ${file1Status.done && file2Status.done ? 'lc-compare-btn-active' : 'lc-compare-btn-disabled'}`}
                  onClick={handleCompare}
                  disabled={comparing || !file1Status.done || !file2Status.done}
                >
                  {comparing ? (
                    <>
                      <Activity size={18} className="lc-spin" />
                      Đang phân tích AI...
                    </>
                  ) : (
                    <>
                      <Layers size={18} />
                      Bắt đầu so sánh
                    </>
                  )}
                </button>
                <p className="lc-compare-hint">
                  {!file1Status.done ? 'Cần tải lên cả 2 tài liệu' :
                   !file2Status.done ? 'Đã sẵn sàng File 1 — hãy tải File 2' :
                   'Nhấn để bắt đầu phân tích bằng RAG + Local LLM'}
                </p>
              </div>
            </div>

            {/* Feature strip */}
            <div className="lc-features">
              {[
                { icon: '🔍', title: 'Phát hiện thay đổi', desc: 'Thêm / Xóa / Sửa theo từng điều khoản' },
                { icon: '📌', title: 'Trích dẫn bằng chứng', desc: 'Đánh dấu trực tiếp trên văn bản gốc' },
                { icon: '🤖', title: 'Hỏi đáp AI', desc: 'Trợ lý pháp lý tương tác trực tiếp' },
                { icon: '🔒', title: 'Bảo mật tuyệt đối', desc: 'Chạy offline, không gửi dữ liệu ra ngoài' },
              ].map((f, i) => (
                <div key={i} className="lc-feature-card">
                  <span className="lc-feature-icon">{f.icon}</span>
                  <strong className="lc-feature-title">{f.title}</strong>
                  <p className="lc-feature-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <ReportView data={report} onReset={handleReset} />
        )}
      </main>

      {/* Loading overlay */}
      {(file1Status.uploading || file2Status.uploading || comparing) && (
        <div className="lc-overlay">
          <div className="lc-overlay-card">
            <div className="lc-overlay-spinner">
              <Activity size={36} className="lc-spin" />
            </div>
            <h3 className="lc-overlay-title">
              {comparing ? 'Đang phân tích tài liệu...' : 'Đang xử lý file...'}
            </h3>
            <p className="lc-overlay-desc">
              {comparing
                ? 'So sánh ngữ nghĩa & tổng hợp báo cáo bằng RAG + Local LLM'
                : 'Chuẩn hóa văn bản, chia đoạn và nhúng vector...'}
            </p>
            <div className="lc-progress-bar">
              <div className="lc-progress-fill" />
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ── Reset & base ── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lc-root {
          font-family: 'Segoe UI', 'Inter', system-ui, sans-serif;
          background: #f0f6ff;
          min-height: 100vh;
          color: #0f2545;
        }

        /* ── Nav ── */
        .lc-nav {
          background: #fff;
          border-bottom: 1px solid #dbeafe;
          position: sticky; top: 0; z-index: 100;
          box-shadow: 0 1px 8px rgba(30,64,175,.06);
        }
        .lc-nav-inner {
          max-width: 1280px; margin: 0 auto;
          padding: 0.75rem 2rem;
          display: flex; align-items: center; justify-content: space-between;
        }
        .lc-brand { display: flex; align-items: center; gap: 0.65rem; }
        .lc-brand-icon {
          background: linear-gradient(135deg,#1d4ed8,#0ea5e9);
          padding: 0.5rem; border-radius: 0.6rem;
          display: flex; align-items: center; justify-content: center;
        }
        .lc-brand-name { font-size: 1.2rem; font-weight: 800; color: #1d4ed8; letter-spacing: -0.3px; }
        .lc-brand-tag {
          font-size: 0.65rem; font-weight: 700; background: #1d4ed8;
          color: #fff; padding: 1px 6px; border-radius: 20px; margin-left: 4px;
          vertical-align: middle;
        }
        .lc-nav-pills { display: flex; gap: 0.5rem; }
        .lc-pill {
          display: flex; align-items: center; gap: 0.3rem;
          background: #eff6ff; color: #1d4ed8;
          font-size: 0.75rem; font-weight: 600;
          padding: 0.3rem 0.75rem; border-radius: 20px;
          border: 1px solid #bfdbfe;
        }

        /* ── Main ── */
        .lc-main { max-width: 1100px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }

        /* ── Hero ── */
        .lc-hero { text-align: center; margin-bottom: 2.5rem; }
        .lc-hero-badge {
          display: inline-flex; align-items: center; gap: 0.4rem;
          background: #dbeafe; color: #1d4ed8;
          font-size: 0.78rem; font-weight: 700;
          padding: 0.35rem 1rem; border-radius: 20px;
          border: 1px solid #bfdbfe; margin-bottom: 1.25rem;
          letter-spacing: 0.02em; text-transform: uppercase;
        }
        .lc-hero-title {
          font-size: clamp(2rem, 4vw, 2.8rem);
          font-weight: 800; line-height: 1.2;
          color: #0f2545; letter-spacing: -0.5px;
          margin-bottom: 1rem;
        }
        .lc-hero-accent {
          background: linear-gradient(90deg, #1d4ed8, #0ea5e9);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lc-hero-sub {
          font-size: 1.05rem; color: #475569; max-width: 540px;
          margin: 0 auto; line-height: 1.7;
        }

        /* ── Card ── */
        .lc-card {
          background: #fff;
          border: 1px solid #dbeafe;
          border-radius: 1.25rem;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(30,64,175,.07);
        }
        .lc-card-header {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 1.5rem 2rem;
          background: linear-gradient(135deg, #eff6ff, #f0f9ff);
          border-bottom: 1px solid #dbeafe;
        }
        .lc-card-header-icon { color: #1d4ed8; flex-shrink: 0; }
        .lc-card-title { font-size: 1.2rem; font-weight: 700; color: #0f2545; }
        .lc-step-hint {
          margin-left: auto; font-size: 0.8rem; color: #64748b;
          background: #e0f2fe; padding: 0.25rem 0.75rem; border-radius: 20px;
        }

        /* ── Upload grid ── */
        .lc-upload-grid {
          display: grid;
          grid-template-columns: 1fr 40px 1fr;
          gap: 0; padding: 2rem;
          align-items: start;
        }
        .lc-slot { padding: 0 1.25rem; }
        .lc-slot-locked { opacity: 0.45; pointer-events: none; }
        .lc-slot-label {
          display: flex; align-items: center; gap: 0.6rem;
          font-size: 1rem; font-weight: 700; color: #0f2545;
          margin-bottom: 1.25rem;
        }
        .lc-slot-num {
          width: 26px; height: 26px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.8rem; font-weight: 800; color: #fff;
          flex-shrink: 0;
        }
        .lc-slot-num-a { background: #1d4ed8; }
        .lc-slot-num-b { background: #0369a1; }
        .lc-slot-num-locked { background: #94a3b8; }
        .lc-check { color: #16a34a; flex-shrink: 0; }

        .lc-slot-divider {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding-top: 3.5rem; gap: 0.5rem;
        }
        .lc-divider-line { width: 1px; height: 40px; background: #dbeafe; }
        .lc-divider-label {
          font-size: 0.7rem; font-weight: 800; color: #93c5fd;
          letter-spacing: 0.1em; text-transform: uppercase;
        }

        .lc-uploaded-box { display: flex; flex-direction: column; gap: 0.75rem; }
        .lc-uploaded-name {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.875rem; font-weight: 600; color: #1e40af;
          background: #eff6ff; padding: 0.6rem 0.9rem; border-radius: 0.6rem;
          border: 1px solid #bfdbfe; word-break: break-all;
        }
        .lc-uploaded-name span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lc-remove-btn {
          background: none; border: 1px solid #fca5a5; color: #dc2626;
          font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.5rem;
          border-radius: 0.4rem; cursor: pointer; flex-shrink: 0;
          transition: background 0.15s;
        }
        .lc-remove-btn:hover { background: #fee2e2; }
        .lc-pdf-preview {
          height: 320px; border-radius: 0.75rem; overflow: hidden;
        }
        .lc-pdf-preview-a { border: 1.5px solid #93c5fd; }
        .lc-pdf-preview-b { border: 1.5px solid #7dd3fc; }

        /* ── Error ── */
        .lc-error {
          margin: 0 2rem 1.5rem;
          padding: 0.875rem 1.25rem;
          background: #fef2f2; color: #dc2626;
          border: 1px solid #fecaca; border-radius: 0.75rem;
          font-size: 0.9rem;
        }

        /* ── Compare button ── */
        .lc-compare-row {
          padding: 1.5rem 2rem 2rem;
          display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
          border-top: 1px solid #dbeafe;
        }
        .lc-compare-btn {
          display: inline-flex; align-items: center; gap: 0.6rem;
          padding: 0.85rem 2.5rem; border-radius: 9999px;
          font-size: 1rem; font-weight: 700; border: none; cursor: pointer;
          transition: all 0.2s; letter-spacing: 0.01em;
        }
        .lc-compare-btn-active {
          background: linear-gradient(135deg,#1d4ed8,#0369a1);
          color: #fff; box-shadow: 0 4px 16px rgba(29,78,216,.3);
        }
        .lc-compare-btn-active:hover {
          transform: translateY(-1px); box-shadow: 0 6px 20px rgba(29,78,216,.4);
        }
        .lc-compare-btn-disabled {
          background: #e2e8f0; color: #94a3b8; cursor: not-allowed;
        }
        .lc-compare-hint { font-size: 0.82rem; color: #94a3b8; }

        /* ── Features ── */
        .lc-features {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem; margin-top: 1.75rem;
        }
        .lc-feature-card {
          background: #fff; border: 1px solid #dbeafe;
          border-radius: 1rem; padding: 1.25rem 1.5rem;
          display: flex; flex-direction: column; gap: 0.5rem;
        }
        .lc-feature-icon { font-size: 1.5rem; }
        .lc-feature-title { font-size: 0.95rem; font-weight: 700; color: #1e3a6e; }
        .lc-feature-desc { font-size: 0.82rem; color: #64748b; line-height: 1.5; }

        /* ── Overlay ── */
        .lc-overlay {
          position: fixed; inset: 0;
          background: rgba(240,246,255,.8); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 9999;
        }
        .lc-overlay-card {
          background: #fff; border: 1px solid #dbeafe;
          padding: 2.5rem 3rem; border-radius: 1.5rem;
          display: flex; flex-direction: column; align-items: center;
          box-shadow: 0 20px 60px rgba(30,64,175,.15);
          text-align: center; min-width: 320px;
        }
        .lc-overlay-spinner {
          width: 64px; height: 64px; border-radius: 50%;
          background: linear-gradient(135deg,#eff6ff,#dbeafe);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1.25rem; color: #1d4ed8;
        }
        .lc-overlay-title { font-size: 1.2rem; font-weight: 700; color: #0f2545; margin-bottom: 0.5rem; }
        .lc-overlay-desc { font-size: 0.875rem; color: #64748b; max-width: 240px; line-height: 1.6; margin-bottom: 1.5rem; }
        .lc-progress-bar { width: 220px; height: 4px; background: #dbeafe; border-radius: 9999px; overflow: hidden; }
        .lc-progress-fill {
          height: 100%; width: 40%; background: linear-gradient(90deg,#1d4ed8,#0ea5e9);
          border-radius: 9999px; animation: lc-progress 1.4s ease-in-out infinite alternate;
        }

        /* ── Animations ── */
        @keyframes lc-progress {
          from { transform: translateX(-60%); }
          to { transform: translateX(160%); }
        }
        @keyframes lc-spin { 100% { transform: rotate(360deg); } }
        .lc-spin { animation: lc-spin 1.2s linear infinite; }
      `}</style>
    </div>
  );
}

export default App;
