import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, FileText, CheckCircle2, Shield, Cpu, Scale, History, Plus, Trash2, MessageSquare } from 'lucide-react';
import Uploader from './components/Uploader';
import ReportView from './components/ReportView';

const API = 'http://localhost:8000';
const GREETING = 'Xin chào! Tôi là trợ lý pháp lý AI. Bạn có thắc mắc gì về những điểm thay đổi trong tài liệu này không?';

function App() {
  const [file1Status, setFile1Status] = useState({ uploading: false, done: false, pdf_url: null, filename: null });
  const [file2Status, setFile2Status] = useState({ uploading: false, done: false, pdf_url: null, filename: null });
  const [comparing, setComparing] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  // ── Lịch sử hội thoại ──
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [chatMessages, setChatMessages] = useState([{ role: 'ai', content: GREETING }]);
  const [loadingConv, setLoadingConv] = useState(false);

  const loadConversations = async () => {
    try {
      const res = await axios.get(`${API}/api/conversations`);
      setConversations(res.data.conversations || []);
    } catch { /* server có thể chưa sẵn sàng */ }
  };

  useEffect(() => { loadConversations(); }, []);

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
      const response = await axios.post(`${API}/api/compare`);
      if (response.data.success) {
        setReport({ ...response.data, pdf_url_a: file1Status.pdf_url, pdf_url_b: file2Status.pdf_url });
        setConversationId(response.data.conversation_id || null);
        setChatMessages([{ role: 'ai', content: GREETING }]);
        loadConversations();
      } else setError('Có lỗi xảy ra trong quá trình so sánh.');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Lỗi kết nối đến server.');
    } finally { setComparing(false); }
  };

  // Bắt đầu một lượt so sánh mới (về màn hình upload), giữ nguyên lịch sử
  const handleReset = () => {
    setReport(null);
    setConversationId(null);
    setChatMessages([{ role: 'ai', content: GREETING }]);
    setFile1Status({ uploading: false, done: false, pdf_url: null, filename: null });
    setFile2Status({ uploading: false, done: false, pdf_url: null, filename: null });
    setError('');
  };

  // Mở lại một cuộc trò chuyện trong lịch sử: khôi phục cả báo cáo lẫn chat
  const openConversation = async (id) => {
    if (loadingConv) return;
    setLoadingConv(true); setError('');
    try {
      const res = await axios.get(`${API}/api/conversations/${id}`);
      const conv = res.data;
      setReport({
        report: conv.report,
        duration_sec: conv.duration_sec,
        pdf_url_a: conv.pdf_url_a,
        pdf_url_b: conv.pdf_url_b,
      });
      setConversationId(conv.id);
      setChatMessages(conv.messages?.length ? conv.messages : [{ role: 'ai', content: GREETING }]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Không mở được cuộc trò chuyện.');
    } finally { setLoadingConv(false); }
  };

  const deleteConversation = async (id, e) => {
    e?.stopPropagation();
    try {
      await axios.delete(`${API}/api/conversations/${id}`);
      if (id === conversationId) handleReset();
      loadConversations();
    } catch { /* bỏ qua */ }
  };

  const busy = file1Status.uploading || file2Status.uploading || comparing;

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg-main)', color: 'var(--text-main)' }}>

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
        <div style={{ padding: '1.35rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.65rem', borderBottom: '1px solid var(--border-hairline)' }}>
          <div style={{ background: 'var(--accent-grad)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 10px rgba(29,99,237,0.35)' }}>
            <Scale size={17} color="#fff" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>LegalCompare</span>
        </div>

        {/* Nav + Lịch sử */}
        <div style={{ flex: 1, minHeight: 0, padding: '1rem 0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Nút so sánh mới */}
          <button
            onClick={handleReset}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.55rem 0.75rem',
              background: 'var(--accent-grad)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.85rem',
              cursor: 'pointer', boxShadow: '0 4px 10px rgba(29,99,237,0.28)', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
          >
            <Plus size={16} /> <span>So sánh mới</span>
          </button>

          {/* Nhãn Lịch sử */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 0.5rem 0.35rem',
            color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem',
            textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
          }}>
            <History size={13} />
            <span>Lịch sử</span>
            {conversations.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-faint)' }}>{conversations.length}</span>
            )}
          </div>

          {/* Danh sách hội thoại */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.15rem', margin: '0 -0.25rem', padding: '0 0.25rem' }}>
            {conversations.length === 0 ? (
              <div style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem', color: 'var(--text-faint)', lineHeight: 1.5 }}>
                Chưa có cuộc trò chuyện nào. Hãy so sánh 2 tài liệu để bắt đầu.
              </div>
            ) : conversations.map(c => {
              const active = c.id === conversationId;
              return (
                <div
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className="lc-conv-item"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 0.6rem', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', fontSize: '0.8rem',
                    background: active ? 'var(--accent-blue-bg)' : 'transparent',
                    color: active ? 'var(--accent-blue)' : 'var(--text-main)',
                    fontWeight: active ? 600 : 500,
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.8 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.title}>
                    {c.title}
                  </span>
                  <button
                    onClick={(e) => deleteConversation(c.id, e)}
                    className="lc-conv-del"
                    title="Xóa cuộc trò chuyện"
                    style={{
                      flexShrink: 0, border: 'none', background: 'transparent',
                      color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
                      display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-sm)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--err-text)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
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
              <div className="lc-fade-up" style={{ marginBottom: '2.25rem', marginTop: '0.5rem' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--accent-blue)', background: 'var(--accent-blue-bg)',
                  padding: '0.3rem 0.7rem', borderRadius: 'var(--radius-pill)', marginBottom: '0.9rem',
                }}>
                  <Shield size={12} /> Chạy cục bộ · Bảo mật tuyệt đối
                </span>
                <h1 style={{ color: 'var(--text-main)', marginBottom: '0.6rem', fontSize: '2.4rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.08 }}>
                  Đối chiếu văn bản pháp lý
                </h1>
                <p style={{ fontSize: '0.98rem', color: 'var(--text-muted)', maxWidth: 560, lineHeight: 1.65, margin: 0 }}>
                  Phát hiện thay đổi điều khoản, tóm tắt sự khác biệt và trích dẫn bằng chứng. Tất cả xử lý ngay trên máy bạn, không gửi dữ liệu ra ngoài.
                </p>
              </div>

              {/* ── Upload panel ── */}
              <div className="lc-fade-up" style={{ border: '1px solid var(--border-hairline)', background: 'var(--bg-panel)', marginBottom: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', animationDelay: '0.06s' }}>

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
                      : !file2Status.done ? 'Đã sẵn sàng File 1, hãy tải File 2'
                        : 'Nhấn để bắt đầu phân tích bằng RAG + Local LLM'}
                  </p>
                  <button
                    onClick={handleCompare}
                    disabled={comparing || !file1Status.done || !file2Status.done}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.6rem 1.4rem',
                      fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: file1Status.done && file2Status.done ? 'pointer' : 'not-allowed',
                      background: file1Status.done && file2Status.done ? 'var(--accent-grad)' : 'var(--border-hairline)',
                      color: file1Status.done && file2Status.done ? '#fff' : 'var(--text-faint)',
                      letterSpacing: '0.02em',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: file1Status.done && file2Status.done ? '0 6px 16px rgba(29,99,237,0.28)' : 'none',
                    }}
                    onMouseEnter={e => { if (file1Status.done && file2Status.done) { e.currentTarget.style.filter = 'brightness(1.08)'; e.currentTarget.style.boxShadow = '0 8px 22px rgba(29,99,237,0.36)'; } }}
                    onMouseLeave={e => { if (file1Status.done && file2Status.done) { e.currentTarget.style.filter = 'none'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(29,99,237,0.28)'; } }}
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
                ].map((f, i) => (
                  <div key={f.title} className="lc-lift lc-fade-up" style={{
                    background: 'var(--bg-panel)', padding: '1.15rem',
                    border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex', alignItems: 'flex-start', gap: '0.85rem',
                    animationDelay: `${0.12 + i * 0.07}s`,
                  }}>
                    <div style={{ color: f.color, background: 'color-mix(in srgb, currentColor 12%, transparent)', padding: '0.55rem', borderRadius: 'var(--radius-md)', display: 'flex', flexShrink: 0 }}>
                      <f.icon size={17} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.25rem' }}>{f.title}</strong>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <ReportView
              data={report}
              onReset={handleReset}
              chatMessages={chatMessages}
              setChatMessages={setChatMessages}
              conversationId={conversationId}
            />
          )}
        </div>
      </main>

      <style>{`
        .lc-conv-del { opacity: 0; transition: opacity 0.15s ease; }
        .lc-conv-item:hover .lc-conv-del { opacity: 1; }
      `}</style>

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
            boxShadow: 'var(--shadow-lg)',
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
              border: '1px solid var(--border-hairline)', color: 'var(--err-text)',
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