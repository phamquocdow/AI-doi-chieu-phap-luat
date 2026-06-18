import React, { useState } from 'react';
import axios from 'axios';
import { Activity, FileText, CheckCircle2, Shield, Cpu, Scale, History } from 'lucide-react';
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)', color: 'var(--text-main)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 250,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-hairline)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        flexShrink: 0
      }}>
        {/* Brand */}
        <div style={{ padding: '1.25rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid var(--border-hairline)' }}>
          <div style={{ background: 'var(--accent-blue)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)' }}>
            <Scale size={16} color="#fff" />
          </div>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>LegalCompare</span>
        </div>

        {/* Nav Links */}
        <div style={{ flex: 1, padding: '1.25rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem',
            background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)',
            borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.85rem',
            position: 'relative', cursor: 'pointer'
          }}>
            <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: '60%', background: 'var(--accent-blue)', borderRadius: '0 2px 2px 0' }} />
            <Scale size={16} />
            <span>Đối chiếu văn bản</span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem',
            color: 'var(--text-muted)', borderRadius: 'var(--radius-md)',
            fontWeight: 500, fontSize: '0.85rem', cursor: 'not-allowed', opacity: 0.7
          }}>
            <History size={16} />
            <span>Lịch sử</span>
          </div>
        </div>

        {/* Footer Pills */}
        <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border-hairline)' }}>
          {[
            { Icon: Shield, label: 'Offline Mode' },
            { Icon: Cpu, label: 'Local LLM' },
          ].map(({ Icon, label }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: 'var(--bg-main)', color: 'var(--text-muted)',
              fontSize: '0.7rem', fontWeight: 600,
              padding: '0.4rem 0.6rem',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <Icon size={14} /> {label}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 1080 }}>
          {!report ? (
            <>
              {/* ── Hero ── */}
              <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ color: 'var(--text-main)', marginBottom: '0.4rem', fontSize: '1.75rem', fontWeight: 700 }}>
                  Đối chiếu văn bản pháp lý
                </h1>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 520, lineHeight: 1.6, margin: 0 }}>
                  Phát hiện thay đổi điều khoản, tóm tắt sự khác biệt và trích dẫn bằng chứng — tất cả chạy cục bộ, bảo mật tuyệt đối.
                </p>
              </div>

              {/* ── Upload panel ── */}
              <div style={{ border: '1px solid var(--border-hairline)', background: 'var(--bg-panel)', marginBottom: '1.5rem', borderRadius: 'var(--radius-md)' }}>

                {/* Card header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '1rem 1.25rem',
                  background: 'var(--bg-sidebar)',
                  borderBottom: '1px solid var(--border-hairline)',
                }}>
                  <FileText size={16} color="var(--accent-blue)" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Tải lên tài liệu so sánh
                  </span>
                  <span style={{
                    marginLeft: 'auto',
                    background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)',
                    fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.5rem',
                    border: '1px solid var(--border-hairline)',
                    letterSpacing: '0.04em',
                    borderRadius: 'var(--radius-pill)',
                  }}>
                    Bản cũ → Bản mới
                  </span>
                </div>

                {/* Upload grid - row based rather than complex grid */}
                <div style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', gap: '1.5rem' }}>

                  {/* Slot 1 */}
                  <SlotPanel
                    num="1" color="var(--accent-blue)" label="Bản cũ"
                    status={file1Status}
                    onUpload={(f) => handleUpload(f, 'file_1')}
                    onRemove={() => setFile1Status({ uploading: false, done: false, pdf_url: null, filename: null })}
                    locked={false}
                  />

                  {/* Divider line instead of "VS" block */}
                  <div style={{ height: 1, background: 'var(--border-hairline)', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', background: 'var(--bg-panel)', padding: '0 0.5rem', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>
                      SO SÁNH VỚI
                    </div>
                  </div>

                  {/* Slot 2 */}
                  <SlotPanel
                    num="2" color="var(--ok-text)" label="Bản mới"
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
                    background: 'var(--err-bg)', color: 'var(--err-text)',
                    borderLeft: '3px solid var(--err-text)',
                    fontSize: '0.85rem',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    {error}
                  </div>
                )}

                {/* Compare row */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderTop: '1px solid var(--border-hairline)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-sidebar)',
                  borderBottomLeftRadius: 'var(--radius-md)', borderBottomRightRadius: 'var(--radius-md)'
                }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                    {!file1Status.done ? 'Cần tải lên cả 2 tài liệu'
                      : !file2Status.done ? 'Đã sẵn sàng File 1 — hãy tải File 2'
                        : 'Nhấn để bắt đầu phân tích bằng RAG + Local LLM'}
                  </p>
                  <button
                    onClick={handleCompare}
                    disabled={comparing || !file1Status.done || !file2Status.done}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: file1Status.done && file2Status.done ? 'pointer' : 'not-allowed',
                      background: file1Status.done && file2Status.done ? 'var(--accent-blue)' : 'var(--border-hairline)',
                      color: file1Status.done && file2Status.done ? '#fff' : 'var(--text-muted)',
                      letterSpacing: '0.03em',
                      transition: 'all 0.2s',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    onMouseEnter={e => { if (file1Status.done && file2Status.done) e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
                    onMouseLeave={e => { if (file1Status.done && file2Status.done) e.currentTarget.style.background = 'var(--accent-blue)'; }}
                  >
                    {comparing
                      ? <><Activity size={16} style={{ animation: 'app-spin 1s linear infinite' }} /> Đang phân tích...</>
                      : <><Scale size={16} /> Bắt đầu so sánh</>
                    }
                  </button>
                </div>
              </div>

              {/* ── Feature list ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {[
                  { title: 'Phát hiện thay đổi', desc: 'Thêm / Xóa / Sửa theo từng điều khoản', icon: FileText, color: 'var(--accent-blue)' },
                  { title: 'Trích dẫn bằng chứng', desc: 'Đánh dấu trực tiếp trên văn bản gốc', icon: CheckCircle2, color: 'var(--ok-text)' },
                  { title: 'Bảo mật tuyệt đối', desc: 'Chạy offline, không gửi dữ liệu ra ngoài', icon: Shield, color: 'var(--warn-text)' },
                ].map((f) => (
                  <div key={f.title} style={{ 
                    background: 'var(--bg-panel)', padding: '1rem', 
                    border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-md)',
                    display: 'flex', alignItems: 'flex-start', gap: '0.75rem'
                  }}>
                    <div style={{ color: f.color, background: 'var(--bg-main)', padding: '0.4rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-hairline)' }}>
                      <f.icon size={16} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>{f.title}</strong>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <ReportView data={report} onReset={handleReset} />
          )}
        </div>
      </main>

      {/* ── Loading overlay ── */}
      {busy && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(26, 31, 43, 0.6)',
          backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-md)',
            padding: '2rem 3rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', minWidth: 320,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}>
            <div style={{
              width: 48, height: 48, border: '1px solid var(--accent-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1rem', color: 'var(--accent-blue)', background: 'var(--accent-blue-bg)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <Activity size={24} style={{ animation: 'app-spin 1s linear infinite' }} />
            </div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 0.4rem' }}>
              {comparing ? 'Đang phân tích tài liệu...' : 'Đang xử lý file...'}
            </h3>
            {/* Progress bar */}
            <div style={{ width: 220, height: 4, background: 'var(--border-hairline)', overflow: 'hidden', borderRadius: 'var(--radius-pill)', marginTop: '1rem' }}>
              <div style={{
                height: '100%', width: '40%', background: 'var(--accent-blue)', borderRadius: 'var(--radius-pill)',
                animation: 'app-progress 1.4s ease-in-out infinite alternate',
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Slot panel component ─────────────────────────────────────────────────────
const SlotPanel = ({ num, color, label, status, onUpload, onRemove, locked, lockedLabel }) => (
  <div style={{ opacity: locked ? 0.5 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
    {/* Label row */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
      <span style={{
        width: 20, height: 20, background: color, color: '#fff',
        fontSize: '0.65rem', fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontVariantNumeric: 'tabular-nums',
        borderRadius: 'var(--radius-sm)',
      }}>{num}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{label}</span>
      {status.done && (
        <CheckCircle2 size={14} color="var(--ok-text)" style={{ flexShrink: 0 }} />
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Filename row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          border: `1px solid var(--border-hairline)`,
          background: 'var(--bg-main)',
          fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-main)',
          wordBreak: 'break-all',
          borderRadius: 'var(--radius-sm)',
        }}>
          <FileText size={14} color={color} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {status.filename}
          </span>
          <button
            onClick={onRemove}
            style={{
              background: 'none', border: '1px solid var(--border-hairline)', color: 'var(--err-text)',
              fontSize: '0.65rem', fontWeight: 600, padding: '0.2rem 0.5rem',
              cursor: 'pointer', flexShrink: 0,
              borderRadius: 'var(--radius-sm)', background: 'var(--bg-panel)'
            }}
          >Xóa</button>
        </div>
        {/* PDF preview */}
        {status.pdf_url && (
          <div style={{ height: 240, overflow: 'hidden', border: `1px solid var(--border-hairline)`, borderRadius: 'var(--radius-sm)' }}>
            <iframe src={`http://localhost:8000${status.pdf_url}`} width="100%" height="100%" style={{ border: 'none', background: '#fff', display: 'block' }} title={`PDF ${num}`} />
          </div>
        )}
      </div>
    )}
  </div>
);

export default App;