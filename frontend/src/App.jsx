import React, { useState } from 'react';
import axios from 'axios';
import { Activity, FileText, CheckCircle2, Shield, Cpu, Scale } from 'lucide-react';
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
      } else throw new Error(response.data.detail || 'Lỗi upload');
    } catch (err) {
      if (slot === 'file_1') setFile1Status({ uploading: false, done: false, pdf_url: null, filename: null });
      else setFile2Status({ uploading: false, done: false, pdf_url: null, filename: null });
      setError(err.response?.data?.detail || err.message || 'Lỗi kết nối đến server.');
    }
  };

  const handleCompare = async () => {
    if (!file1Status.done || !file2Status.done) { setError('Vui lòng upload hoàn tất cả 2 file để so sánh.'); return; }
    setComparing(true); setError('');
    try {
      const response = await axios.post('http://localhost:8000/api/compare');
      if (response.data.success) {
        setReport({ ...response.data, pdf_url_a: file1Status.pdf_url, pdf_url_b: file2Status.pdf_url });
      } else setError('Có lỗi xảy ra trong quá trình so sánh.');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Lỗi kết nối đến server.');
    } finally { setComparing(false); }
  };

  const handleReset = () => {
    setReport(null);
    setFile1Status({ uploading: false, done: false, pdf_url: null, filename: null });
    setFile2Status({ uploading: false, done: false, pdf_url: null, filename: null });
    setError('');
  };

  const busy = file1Status.uploading || file2Status.uploading || comparing;

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#F8FAFC', minHeight: '100vh', color: '#0F172A' }}>

      {/* ── Nav ── */}
      <header style={{
        background: '#0A1628',
        borderBottom: '4px solid #1B4FD8',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: '100%', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#1B4FD8', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scale size={20} color="#fff" />
            </div>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>LegalCompare</span>
          </div>
          {/* Pills */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { Icon: Shield, label: 'Offline' },
              { Icon: Cpu, label: 'Local LLM' },
            ].map(({ Icon, label }) => (
              <span key={label} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.07)', color: '#93C5FD',
                fontSize: '0.72rem', fontWeight: 700,
                padding: '0.25rem 0.7rem',
                border: '1px solid rgba(255,255,255,0.12)',
                letterSpacing: '0.05em',
              }}>
                <Icon size={12} /> {label}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '100%', margin: '0 auto', padding: '2.5rem 2rem 4rem' }}>
        {!report ? (
          <>
            {/* ── Hero ── */}
            <div style={{
              background: '#0A1628',
              borderLeft: '6px solid #1B4FD8',
              padding: '2.5rem 3rem',
              marginBottom: '2rem',
            }}>
              <h1 style={{ color: '#1B4FD8' }}>
                Đối chiếu văn bản<br />
                <span style={{ color: '#1B4FD8' }}>pháp lý thông minh</span>
              </h1>
              <p style={{ fontSize: '1rem', color: '#94A3B8', maxWidth: 520, lineHeight: 1.7, margin: 0 }}>
                Phát hiện thay đổi điều khoản, tóm tắt sự khác biệt và trích dẫn bằng chứng — tất cả chạy cục bộ, bảo mật tuyệt đối.
              </p>
            </div>

            {/* ── Upload panel ── */}
            <div style={{ border: '1.5px solid #CBD5E1', background: '#fff', marginBottom: '1.5rem' }}>

              {/* Card header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.875rem 1.5rem',
                background: '#0A1628',
                borderBottom: '3px solid #1B4FD8',
              }}>
                <FileText size={16} color="#93C5FD" />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Tải lên tài liệu so sánh
                </span>
                <span style={{
                  marginLeft: 'auto',
                  background: 'rgba(255,255,255,0.08)', color: '#93C5FD',
                  fontSize: '0.68rem', fontWeight: 700, padding: '0.18rem 0.6rem',
                  border: '1px solid rgba(255,255,255,0.15)',
                  letterSpacing: '0.06em',
                }}>
                  Tải lần lượt Bản cũ → Bản mới
                </span>
              </div>

              {/* Upload grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 1fr', padding: '2rem', gap: 0, alignItems: 'start' }}>

                {/* Slot 1 */}
                <SlotPanel
                  num="01" color="#1B4FD8" label="Bản cũ"
                  status={file1Status}
                  onUpload={(f) => handleUpload(f, 'file_1')}
                  onRemove={() => setFile1Status({ uploading: false, done: false, pdf_url: null, filename: null })}
                  locked={false}
                />

                {/* Divider */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '3rem', gap: 6 }}>
                  <div style={{ width: 1, height: 36, background: '#CBD5E1' }} />
                  <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#1B4FD8', letterSpacing: '0.1em' }}>VS</span>
                  <div style={{ width: 1, height: 36, background: '#CBD5E1' }} />
                </div>

                {/* Slot 2 */}
                <SlotPanel
                  num="02" color="#15803D" label="Bản mới"
                  status={file2Status}
                  onUpload={(f) => handleUpload(f, 'file_2')}
                  onRemove={() => setFile2Status({ uploading: false, done: false, pdf_url: null, filename: null })}
                  locked={!file1Status.done}
                  lockedLabel="Chờ xử lý xong File 1"
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  margin: '0 1.5rem 1.5rem',
                  padding: '0.75rem 1rem',
                  background: '#FEE2E2', color: '#7F1D1D',
                  borderLeft: '4px solid #B91C1C',
                  fontSize: '0.875rem',
                }}>
                  {error}
                </div>
              )}

              {/* Compare row */}
              <div style={{
                padding: '1.5rem',
                borderTop: '1px solid #E2E8F0',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              }}>
                <button
                  onClick={handleCompare}
                  disabled={comparing || !file1Status.done || !file2Status.done}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.75rem 2rem',
                    fontSize: '0.9rem', fontWeight: 600, border: 'none', cursor: file1Status.done && file2Status.done ? 'pointer' : 'not-allowed',
                    background: file1Status.done && file2Status.done ? '#1B4FD8' : '#E2E8F0',
                    color: file1Status.done && file2Status.done ? '#fff' : '#94A3B8',
                    letterSpacing: '0.03em', textTransform: 'full-width',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (file1Status.done && file2Status.done) e.currentTarget.style.background = '#1E3A8A'; }}
                  onMouseLeave={e => { if (file1Status.done && file2Status.done) e.currentTarget.style.background = '#1B4FD8'; }}
                >
                  {comparing
                    ? <><Activity size={16} style={{ animation: 'app-spin 1s linear infinite' }} /> Đang phân tích...</>
                    : <><Scale size={16} /> Bắt đầu so sánh</>
                  }
                </button>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: 0 }}>
                  {!file1Status.done ? 'Cần tải lên cả 2 tài liệu'
                    : !file2Status.done ? 'Đã sẵn sàng File 1 — hãy tải File 2'
                      : 'Nhấn để bắt đầu phân tích bằng RAG + Local LLM'}
                </p>
              </div>
            </div>

            {/* ── Feature strip ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 2, background: '#CBD5E1' }}>
              {[
                { title: 'Phát hiện thay đổi', desc: 'Thêm / Xóa / Sửa theo từng điều khoản', bar: '#1B4FD8' },
                { title: 'Trích dẫn bằng chứng', desc: 'Đánh dấu trực tiếp trên văn bản gốc', bar: '#15803D' },
                { title: 'Hỏi đáp AI', desc: 'Trợ lý pháp lý tương tác trực tiếp', bar: '#B45309' },
                { title: 'Bảo mật tuyệt đối', desc: 'Chạy offline, không gửi dữ liệu ra ngoài', bar: '#B91C1C' },
              ].map((f) => (
                <div key={f.title} style={{ background: '#fff', padding: '1.25rem 1.5rem', borderTop: `4px solid ${f.bar}` }}>
                  <strong style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0A1628', display: 'block', marginBottom: '0.4rem' }}>{f.title}</strong>
                  <p style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.55, margin: 0 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <ReportView data={report} onReset={handleReset} />
        )}
      </main>

      {/* ── Loading overlay ── */}
      {busy && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,22,40,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#fff',
            border: '4px solid #1B4FD8',
            padding: '2.5rem 3rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', minWidth: 320,
          }}>
            <div style={{
              width: 56, height: 56, border: '3px solid #1B4FD8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1.25rem', color: '#1B4FD8',
            }}>
              <Activity size={28} style={{ animation: 'app-spin 1s linear infinite' }} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0A1628', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {comparing ? 'Đang phân tích tài liệu...' : 'Đang xử lý file...'}
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: 240, lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            </p>
            {/* Progress bar */}
            <div style={{ width: 220, height: 3, background: '#E2E8F0', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: '40%', background: '#1B4FD8',
                animation: 'app-progress 1.4s ease-in-out infinite alternate',
              }} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes app-spin { 100% { transform: rotate(360deg); } }
        @keyframes app-progress { from { transform: translateX(-60%); } to { transform: translateX(300%); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  );
}

// ── Slot panel component ─────────────────────────────────────────────────────
const SlotPanel = ({ num, color, label, status, onUpload, onRemove, locked, lockedLabel }) => (
  <div style={{ padding: '0 1.25rem', opacity: locked ? 0.45 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
    {/* Label row */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
      <span style={{
        width: 28, height: 28, background: color, color: '#fff',
        fontSize: '0.72rem', fontWeight: 900,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontVariantNumeric: 'tabular-nums',
      }}>{num}</span>
      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0A1628' }}>{label}</span>
      {status.done && (
        <CheckCircle2 size={16} color="#15803D" style={{ flexShrink: 0 }} />
      )}
    </div>

    {!status.done ? (
      <Uploader
        label={locked ? lockedLabel : `Chọn file (DOCX / PDF)`}
        disabled={status.uploading || locked}
        onFileChange={onUpload}
        iconColor={color}
      />
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Filename row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.6rem 0.875rem',
          border: `2px solid ${color}`,
          background: '#F8FAFC',
          fontSize: '0.85rem', fontWeight: 600, color,
          wordBreak: 'break-all',
        }}>
          <FileText size={14} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {status.filename}
          </span>
          <button
            onClick={onRemove}
            style={{
              background: 'none', border: '1.5px solid #B91C1C', color: '#B91C1C',
              fontSize: '0.68rem', fontWeight: 800, padding: '0.15rem 0.5rem',
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
            }}
          >Xóa</button>
        </div>
        {/* PDF preview */}
        {status.pdf_url && (
          <div style={{ height: 320, overflow: 'hidden', border: `2px solid ${color}` }}>
            <iframe src={`http://localhost:8000${status.pdf_url}`} width="100%" height="100%" style={{ border: 'none', background: '#fff', display: 'block' }} title={`PDF ${num}`} />
          </div>
        )}
      </div>
    )}
  </div>
);

export default App;