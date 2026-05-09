import React, { useState, useMemo } from 'react';
import {
  ArrowLeft, CheckCircle, AlertTriangle, XCircle, PlusCircle, Trash2,
  ChevronDown, ChevronUp, Clock, GitCompare, FileText, BarChart2,
  MessageSquare, Activity
} from 'lucide-react';
import Chatbot from './Chatbot';
import DocumentPaperView from './DocumentPaperView';

// ── Word-level diff ──────────────────────────────────────────────────────────
function tokenize(text) { return text ? text.split(/(\s+)/) : []; }

function lcs(a, b) {
  const m = a.length, n = b.length;
  const matrix = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      matrix[i][j] = a[i - 1] === b[j - 1]
        ? matrix[i - 1][j - 1] + 1
        : Math.max(matrix[i - 1][j], matrix[i][j - 1]);
  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { result.unshift({ type: 'equal', value: a[i - 1] }); i--; j--; }
    else if (matrix[i - 1][j] >= matrix[i][j - 1]) { result.unshift({ type: 'delete', value: a[i - 1] }); i--; }
    else { result.unshift({ type: 'insert', value: b[j - 1] }); j--; }
  }
  while (i > 0) { result.unshift({ type: 'delete', value: a[i - 1] }); i--; }
  while (j > 0) { result.unshift({ type: 'insert', value: b[j - 1] }); j--; }
  return result;
}

const DiffPanel = ({ textA, textB, side }) => {
  const diff = useMemo(() => lcs(tokenize(textA || ''), tokenize(textB || '')), [textA, textB]);
  const hasChanges = diff.some(d => d.type !== 'equal');
  return (
    <div style={{
      padding: '0.875rem 1rem', fontSize: '0.875rem', lineHeight: 1.85,
      whiteSpace: 'pre-wrap', maxHeight: 280, overflowY: 'auto',
      background: '#fff',
      border: side === 'a' ? '2px solid #E63946' : '2px solid #1B4FD8',
    }}>
      {!hasChanges
        ? <span style={{ color: '#64748b' }}>{textA || textB || <em>Không có nội dung.</em>}</span>
        : diff.map((token, idx) => {
          if (token.type === 'equal') return <span key={idx}>{token.value}</span>;
          if (side === 'a' && token.type === 'delete')
            return <mark key={idx} style={{ background: '#FFD6D6', color: '#B00020', textDecoration: 'line-through', textDecorationColor: '#E63946', padding: '0 2px' }}>{token.value}</mark>;
          if (side === 'b' && token.type === 'insert')
            return <mark key={idx} style={{ background: '#D0DBFF', color: '#1B4FD8', padding: '0 2px' }}>{token.value}</mark>;
          return null;
        })
      }
    </div>
  );
};

// ── Stat card ────────────────────────────────────────────────────────────────
const STAT_CFG = {
  blue: { bg: '#1B4FD8', label: '#fff', val: '#fff' },
  green: { bg: '#15803D', label: '#fff', val: '#fff' },
  amber: { bg: '#B45309', label: '#fff', val: '#fff' },
  red: { bg: '#B91C1C', label: '#fff', val: '#fff' },
};

const StatCard = ({ title, value, variant }) => {
  const c = STAT_CFG[variant] || STAT_CFG.blue;
  return (
    <div style={{ background: c.bg, padding: '1.1rem 1.25rem' }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.4rem' }}>{title}</p>
      <p style={{ fontSize: '2.25rem', fontWeight: 900, color: '#fff', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    </div>
  );
};

// ── Status & importance ──────────────────────────────────────────────────────
const STATUS = {
  unchanged: { Icon: CheckCircle, label: 'Không đổi', color: '#15803D', bg: '#DCFCE7', border: '#15803D' },
  modified: { Icon: AlertTriangle, label: 'Có thay đổi', color: '#92400E', bg: '#FEF3C7', border: '#B45309' },
  added: { Icon: PlusCircle, label: 'Thêm mới', color: '#1E3A8A', bg: '#DBEAFE', border: '#1B4FD8' },
  deleted: { Icon: Trash2, label: 'Đã xóa', color: '#7F1D1D', bg: '#FEE2E2', border: '#B91C1C' },
  blocked: { Icon: XCircle, label: 'Không xác định', color: '#334155', bg: '#F1F5F9', border: '#64748B' },
};
const IMP = {
  high: { label: 'Quan trọng', color: '#7F1D1D', bg: '#FEE2E2', border: '#B91C1C' },
  medium: { label: 'Trung bình', color: '#92400E', bg: '#FEF3C7', border: '#B45309' },
  low: { label: 'Thấp', color: '#1E3A8A', bg: '#DBEAFE', border: '#1B4FD8' },
};

// ── Clause row ───────────────────────────────────────────────────────────────
const ClauseDetail = ({ item, index }) => {
  const [expanded, setExpanded] = useState(false);
  const [diffMode, setDiffMode] = useState(true);
  const st = STATUS[item.clause_change_type] || STATUS.blocked;
  const imp = IMP[item.importance];
  const isUnchanged = item.clause_change_type === 'unchanged';

  const Badge = ({ label, color, bg, border }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: '0.68rem', fontWeight: 700, padding: '0.18rem 0.55rem',
      background: bg, color, border: `1.5px solid ${border}`,
    }}>{label}</span>
  );

  return (
    <div style={{ borderBottom: '1px solid #E2E8F0', background: expanded ? '#F8FAFF' : '#fff' }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1.25rem', cursor: 'pointer' }}
      >
        {/* Index box */}
        <span style={{
          width: 30, height: 30, background: '#0A1628', color: '#fff',
          fontSize: '0.72rem', fontWeight: 900, display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {String(index).padStart(2, '0')}
        </span>

        {/* Status stripe */}
        <span style={{ width: 4, height: 30, background: st.border, flexShrink: 0 }} />

        {/* Title */}
        <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, color: '#0F172A' }}>
          {item.clause_title || `Điều khoản ${index}`}
        </span>

        {/* Badges */}
        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
          <Badge label={st.label} color={st.color} bg={st.bg} border={st.border} />
          {!isUnchanged && imp && <Badge label={imp.label} color={imp.color} bg={imp.bg} border={imp.border} />}
        </div>

        <span style={{ color: '#94A3B8', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '2px solid #1B4FD8' }}>
          {item.summary && (
            <div style={{
              background: '#EFF6FF', borderLeft: '4px solid #1B4FD8',
              padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#1E3A6E',
              lineHeight: 1.65, margin: '1rem 0',
            }}>
              <strong style={{ color: '#0A1628' }}>Tóm tắt: </strong>{item.summary}
            </div>
          )}

          {(item.content_a || item.content_b) && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                  So sánh nội dung
                </span>
                <button
                  onClick={() => setDiffMode(m => !m)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '0.25rem 0.7rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                    background: diffMode ? '#1B4FD8' : '#fff',
                    border: '1.5px solid #1B4FD8',
                    color: diffMode ? '#fff' : '#1B4FD8',
                  }}
                >
                  <GitCompare size={11} />
                  {diffMode ? 'Highlight bật' : 'Bật highlight'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                {/* Side A */}
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff', background: '#E63946', padding: '0.2rem 0.6rem', display: 'inline-block', marginBottom: '0.4rem', letterSpacing: '0.07em' }}>
                    BẢN CŨ
                  </div>
                  <DiffPanel textA={item.content_a} textB={item.content_b} side="a" />
                  {item.citations_a?.length > 0 && (
                    <div style={{ marginTop: '0.5rem', padding: '0.65rem 0.875rem', background: '#FEE2E2', borderLeft: '3px solid #E63946', fontSize: '0.8rem', color: '#7F1D1D' }}>
                      <strong>Từ khóa bị xóa:</strong>
                      <ul style={{ paddingLeft: '1rem', marginTop: '0.25rem' }}>{item.citations_a.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  )}
                </div>
                {/* Side B */}
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff', background: '#1B4FD8', padding: '0.2rem 0.6rem', display: 'inline-block', marginBottom: '0.4rem', letterSpacing: '0.07em' }}>
                    BẢN MỚI
                  </div>
                  <DiffPanel textA={item.content_a} textB={item.content_b} side="b" />
                  {item.citations_b?.length > 0 && (
                    <div style={{ marginTop: '0.5rem', padding: '0.65rem 0.875rem', background: '#DBEAFE', borderLeft: '3px solid #1B4FD8', fontSize: '0.8rem', color: '#1E3A8A' }}>
                      <strong>Từ khóa được thêm:</strong>
                      <ul style={{ paddingLeft: '1rem', marginTop: '0.25rem' }}>{item.citations_b.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Section label bar ────────────────────────────────────────────────────────
const SectionLabel = ({ icon: Icon, label, count }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.6rem 1.25rem',
    background: '#F1F5F9',
    borderBottom: '1px solid #CBD5E1',
    borderTop: '1px solid #CBD5E1',
    fontSize: '0.7rem', fontWeight: 700,
    color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em',
  }}>
    <Icon size={13} />
    {label}
    {count != null && (
      <span style={{
        marginLeft: 'auto',
        background: '#1B4FD8', color: '#fff',
        fontSize: '0.68rem', fontWeight: 800,
        padding: '0.1rem 0.55rem',
      }}>
        {count} mục
      </span>
    )}
  </div>
);

// ── Main ─────────────────────────────────────────────────────────────────────
const ReportView = ({ data, onReset }) => {
  const { report, duration_sec, pdf_url_a, pdf_url_b } = data;
  const { summary, details } = report;
  const [activeTab, setActiveTab] = useState('report');

  const enrichedDetails = useMemo(() => {
    return details.map(item => {
      if (item.clause_change_type !== 'modified' || !item.content_a || !item.content_b) return item;
      const diff = lcs(tokenize(item.content_a), tokenize(item.content_b));
      return { ...item, _lcsDiff: diff };
    });
  }, [details]);

  const similarityPct = summary.total_clauses_compared > 0
    ? Math.round((summary.unchanged_clauses / summary.total_clauses_compared) * 100)
    : 0;

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", color: '#0F172A' }}>

      {/* ── Master header ── */}
      <div style={{
        background: '#0A1628',
        padding: '0 1.75rem',
        display: 'flex', alignItems: 'stretch', justifyContent: 'space-between',
        borderBottom: '4px solid #1B4FD8',
      }}>
        <div style={{ padding: '1.25rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span style={{
              background: '#1B4FD8', color: '#fff',
              fontSize: '0.58rem', fontWeight: 900, letterSpacing: '0.18em',
              padding: '0.18rem 0.55rem', textTransform: 'uppercase',
            }}>BÁO CÁO</span>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600, letterSpacing: '0.06em' }}>ĐỐI CHIẾU HỢP ĐỒNG</span>
          </div>
          <h2 style={{ color: '#fff' }}>
            Kết quả Phân tích và Đối chiếu
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: '0.35rem', fontSize: '0.78rem', color: '#64748B' }}>
            <Clock size={12} />
            Hoàn tất trong&nbsp;<strong style={{ color: '#93C5FD' }}>{duration_sec}s</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button
            onClick={onReset}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.6rem 1.25rem',
              border: '1.5px solid rgba(255,255,255,0.2)',
              background: 'transparent', color: '#CBD5E1',
              fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <ArrowLeft size={14} /> So sánh mới
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', background: '#fff' }}>
        {[
          { id: 'report', label: 'Báo cáo Đối chiếu', Icon: BarChart2 },
          { id: 'chat', label: 'Trợ lý AI Hỏi đáp', Icon: MessageSquare },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.85rem 1.5rem', border: 'none', background: 'transparent',
              fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
              color: activeTab === id ? '#1B4FD8' : '#64748b',
              borderBottom: `3px solid ${activeTab === id ? '#1B4FD8' : 'transparent'}`,
              marginBottom: -2,
            }}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'report' ? (
        <>
          {/* ── PDF viewer ── */}
          <div style={{ marginBottom: '1.5rem' }}>
            <DocumentPaperView
              pdfUrlA={pdf_url_a ? `http://localhost:8000${pdf_url_a}` : null}
              pdfUrlB={pdf_url_b ? `http://localhost:8000${pdf_url_b}` : null}
              details={enrichedDetails}
            />
          </div>

          {/* ══ REPORT FRAME ══ */}
          <div style={{ border: '1.5px solid #CBD5E1', background: '#fff', marginBottom: '2rem' }}>

            {/* Frame header bar */}
            <div style={{
              background: '#0A1628',
              padding: '0.9rem 1.25rem',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <FileText size={16} color="#93C5FD" />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Báo Cáo Tổng Hợp
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748B' }}>
                Phân tích chi tiết sự khác biệt giữa hai phiên bản hợp đồng
              </span>
            </div>

            {/* ── SECTION: Thống kê ── */}
            <SectionLabel icon={Activity} label="Thống kê tổng quan" />
            <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '2px', background: '#E2E8F0' }}>
              <StatCard title="Tổng đoạn" value={summary.total_clauses_compared} variant="blue" />
              <StatCard title="Đã đối khớp" value={summary.matched_clauses} variant="blue" />
              <StatCard title="Không thay đổi" value={summary.unchanged_clauses} variant="green" />
              <StatCard title="Có thay đổi" value={summary.modified_clauses} variant="amber" />
              <StatCard title="Không xác định" value={summary.blocked_or_unsupported_clauses} variant="red" />
            </div>

            {/* Legend strip */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', padding: '0.75rem 1.25rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {[
                { color: '#15803D', label: 'Không thay đổi' },
                { color: '#B45309', label: 'Có thay đổi' },
                { color: '#1B4FD8', label: 'Thêm mới' },
                { color: '#B91C1C', label: 'Đã xóa' },
                { color: '#64748B', label: 'Không xác định' },
              ].map(({ color, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, background: color, flexShrink: 0 }} />
                  {label}
                </span>
              ))}
            </div>

            {/* ── SECTION: Chi tiết ── */}
            <SectionLabel icon={FileText} label="Chi tiết điều khoản" count={details.length} />
            <div style={{ background: '#fff' }}>
              {enrichedDetails.map((item, i) => (
                <ClauseDetail key={i} item={item} index={i + 1} />
              ))}
            </div>

            {/* Frame footer */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
              padding: '0.75rem 1.25rem',
              background: '#F1F5F9', borderTop: '1px solid #CBD5E1',
              fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500,
            }}>
              <span>Báo cáo được tạo tự động bởi hệ thống phân tích hợp đồng AI</span>
              <span style={{ width: 3, height: 3, background: '#CBD5E1' }} />
              <span>Thời gian xử lý: {duration_sec}s</span>
            </div>
          </div>
        </>
      ) : (
        <div style={{ marginTop: '1.5rem' }}><Chatbot /></div>
      )}
    </div>
  );
};

export default ReportView;