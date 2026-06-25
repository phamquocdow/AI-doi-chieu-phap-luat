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

const DiffPanel = ({ textA, textB, side, diffMode = true }) => {
  const diff = useMemo(() => lcs(tokenize(textA || ''), tokenize(textB || '')), [textA, textB]);
  const hasChanges = diff.some(d => d.type !== 'equal');
  const plainText = side === 'a' ? textA : textB;
  return (
    <div style={{
      padding: '0.875rem 1rem', fontSize: '0.85rem', lineHeight: 1.7,
      whiteSpace: 'pre-wrap', maxHeight: 280, overflowY: 'auto',
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-hairline)',
      borderLeft: `3px solid ${side === 'a' ? 'var(--err-text)' : 'var(--accent-blue)'}`,
      borderRadius: 'var(--radius-sm)',
      color: 'var(--text-main)',
    }}>
      {!diffMode
        ? <span>{plainText || <em style={{ color: 'var(--text-muted)' }}>Không có nội dung.</em>}</span>
        : !hasChanges
        ? <span style={{ color: 'var(--text-muted)' }}>{textA || textB || <em>Không có nội dung.</em>}</span>
        : diff.map((token, idx) => {
          if (token.type === 'equal') return <span key={idx}>{token.value}</span>;
          if (side === 'a' && token.type === 'delete')
            return <mark key={idx} style={{ background: 'var(--err-bg)', color: 'var(--err-text)', textDecoration: 'line-through', padding: '0 2px', borderRadius: '2px' }}>{token.value}</mark>;
          if (side === 'b' && token.type === 'insert')
            return <mark key={idx} style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', padding: '0 2px', borderRadius: '2px' }}>{token.value}</mark>;
          return null;
        })
      }
    </div>
  );
};

// ── Stat card ────────────────────────────────────────────────────────────────
const STAT_CFG = {
  blue: { color: 'var(--accent-blue)' },
  green: { color: 'var(--ok-text)' },
  amber: { color: 'var(--warn-text)' },
  red: { color: 'var(--err-text)' },
};

const StatCard = ({ title, value, variant }) => {
  const c = STAT_CFG[variant] || STAT_CFG.blue;
  return (
    <div
      style={{ background: 'var(--bg-panel)', padding: '1.3rem 1.25rem', borderRight: '1px solid var(--border-hairline)', transition: 'background 0.18s ease' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-panel)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0 0 0.4rem' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
        <p style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{title}</p>
      </div>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 700, color: c.color, margin: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</p>
    </div>
  );
};

// ── Status & importance ──────────────────────────────────────────────────────
const STATUS = {
  unchanged: { Icon: CheckCircle, label: 'Không đổi', color: 'var(--ok-text)', bg: 'var(--ok-bg)' },
  modified: { Icon: AlertTriangle, label: 'Có thay đổi', color: 'var(--warn-text)', bg: 'var(--warn-bg)' },
  added: { Icon: PlusCircle, label: 'Thêm mới', color: 'var(--accent-blue)', bg: 'var(--accent-blue-bg)' },
  deleted: { Icon: Trash2, label: 'Đã xóa', color: 'var(--err-text)', bg: 'var(--err-bg)' },
  blocked: { Icon: XCircle, label: 'Không xác định', color: 'var(--text-muted)', bg: 'var(--bg-main)' },
};
const IMP = {
  high: { label: 'Quan trọng', color: 'var(--err-text)', bg: 'var(--err-bg)' },
  medium: { label: 'Trung bình', color: 'var(--warn-text)', bg: 'var(--warn-bg)' },
  low: { label: 'Thấp', color: 'var(--accent-blue)', bg: 'var(--accent-blue-bg)' },
};

// ── Clause row ───────────────────────────────────────────────────────────────
const ClauseDetail = ({ item, index }) => {
  const [expanded, setExpanded] = useState(false);
  const [diffMode, setDiffMode] = useState(true);
  const st = STATUS[item.clause_change_type] || STATUS.blocked;
  const imp = IMP[item.importance];
  const isUnchanged = item.clause_change_type === 'unchanged';

  const Badge = ({ label, color, bg }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: '0.65rem', fontWeight: 600, padding: '0.2rem 0.6rem',
      background: bg, color,
      borderRadius: 'var(--radius-pill)',
    }}>{label}</span>
  );

  return (
    <div style={{ borderBottom: '1px solid var(--border-hairline)', background: expanded ? 'var(--bg-sidebar)' : 'var(--bg-panel)' }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.95rem 1.25rem', cursor: 'pointer', transition: 'background 0.15s ease' }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Index box */}
        <span style={{
          width: 24,
          fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {String(index).padStart(2, '0')}
        </span>

        {/* Title */}
        <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
          {item.clause_title || `Điều khoản ${index}`}
        </span>

        {/* Badges */}
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
          <Badge label={st.label} color={st.color} bg={st.bg} />
          {!isUnchanged && imp && <Badge label={imp.label} color={imp.color} bg={imp.bg} />}
        </div>

        <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '0.5rem' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: '0 1.25rem 1.25rem 3rem' }}>
          {item.summary && (
            <div style={{
              background: 'var(--bg-panel)', border: '1px solid var(--border-hairline)',
              padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-main)',
              lineHeight: 1.6, marginBottom: '1rem', borderRadius: 'var(--radius-sm)',
            }}>
              <strong style={{ color: 'var(--text-main)', fontSize: '0.8rem' }}>Tóm tắt thay đổi: </strong>{item.summary}
            </div>
          )}

          {(item.content_a || item.content_b) && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Chi tiết nội dung
                </span>
                <button
                  onClick={() => setDiffMode(m => !m)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600,
                    background: diffMode ? 'var(--accent-blue)' : 'var(--bg-panel)',
                    border: `1px solid ${diffMode ? 'var(--accent-blue)' : 'var(--border-hairline)'}`,
                    color: diffMode ? '#fff' : 'var(--text-muted)',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'all 0.2s',
                  }}
                >
                  <GitCompare size={12} />
                  {diffMode ? 'Tắt so sánh' : 'Bật so sánh'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Side A */}
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    BẢN CŨ
                  </div>
                  <DiffPanel textA={item.content_a} textB={item.content_b} side="a" diffMode={diffMode} />
                  {item.citations_a?.length > 0 && (
                    <div style={{ marginTop: '0.5rem', padding: '0.65rem 0.875rem', background: 'var(--bg-panel)', border: '1px solid var(--border-hairline)', borderLeft: '3px solid var(--err-text)', fontSize: '0.8rem', color: 'var(--text-main)', borderRadius: 'var(--radius-sm)' }}>
                      <strong style={{ fontSize: '0.75rem', color: 'var(--err-text)' }}>Từ khóa bị xóa:</strong>
                      <ul style={{ paddingLeft: '1rem', marginTop: '0.25rem', margin: 0 }}>{item.citations_a.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  )}
                </div>
                {/* Side B */}
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    BẢN MỚI
                  </div>
                  <DiffPanel textA={item.content_a} textB={item.content_b} side="b" diffMode={diffMode} />
                  {item.citations_b?.length > 0 && (
                    <div style={{ marginTop: '0.5rem', padding: '0.65rem 0.875rem', background: 'var(--bg-panel)', border: '1px solid var(--border-hairline)', borderLeft: '3px solid var(--accent-blue)', fontSize: '0.8rem', color: 'var(--text-main)', borderRadius: 'var(--radius-sm)' }}>
                      <strong style={{ fontSize: '0.75rem', color: 'var(--accent-blue)' }}>Từ khóa được thêm:</strong>
                      <ul style={{ paddingLeft: '1rem', marginTop: '0.25rem', margin: 0 }}>{item.citations_b.map((c, i) => <li key={i}>{c}</li>)}</ul>
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
    padding: '0.75rem 1.25rem',
    background: 'var(--bg-sidebar)',
    borderBottom: '1px solid var(--border-hairline)',
    borderTop: '1px solid var(--border-hairline)',
    fontSize: '0.7rem', fontWeight: 600,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  }}>
    <Icon size={14} />
    {label}
    {count != null && (
      <span style={{
        marginLeft: 'auto',
        background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)',
        fontSize: '0.65rem', fontWeight: 700,
        padding: '0.15rem 0.6rem',
        borderRadius: 'var(--radius-pill)',
      }}>
        {count}
      </span>
    )}
  </div>
);

// ── Main ─────────────────────────────────────────────────────────────────────
const ReportView = ({ data, onReset, chatMessages, setChatMessages, conversationId }) => {
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
    <div style={{ color: 'var(--text-main)', width: '100%', maxWidth: 1080 }}>

      {/* ── Master header ── */}
      <div className="lc-fade-up" style={{
        background: 'var(--bg-panel)',
        padding: '1.6rem 2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '1.5rem',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--accent-grad)' }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{
              background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)',
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
              padding: '0.2rem 0.5rem', textTransform: 'uppercase',
              borderRadius: 'var(--radius-sm)',
            }}>Báo Cáo</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Đối chiếu hợp đồng</span>
          </div>
          <h2 style={{ color: 'var(--text-main)', fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0 0' }}>
            Kết quả Phân tích
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Clock size={14} />
            Hoàn tất trong <strong style={{ color: 'var(--text-main)' }}>{duration_sec}s</strong>
          </div>
        </div>

        <button
          onClick={onReset}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.5rem 1rem',
            border: '1px solid var(--border-hairline)',
            background: 'var(--bg-sidebar)', color: 'var(--text-main)',
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-sidebar)'; e.currentTarget.style.borderColor = 'var(--border-hairline)'; e.currentTarget.style.color = 'var(--text-main)'; }}
        >
          <ArrowLeft size={16} /> So sánh mới
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-hairline)', marginBottom: '1.5rem' }}>
        {[
          { id: 'report', label: 'Báo cáo Chi tiết', Icon: BarChart2 },
          { id: 'chat', label: 'Trợ lý AI Hỏi đáp', Icon: MessageSquare },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.8rem 1.5rem', border: 'none', background: 'transparent',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              color: activeTab === id ? 'var(--accent-blue)' : 'var(--text-muted)',
              borderBottom: `2px solid ${activeTab === id ? 'var(--accent-blue)' : 'transparent'}`,
              marginBottom: -1,
            }}
            onMouseEnter={e => { if (activeTab !== id) e.currentTarget.style.color = 'var(--text-main)'; }}
            onMouseLeave={e => { if (activeTab !== id) e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Icon size={16} /> {label}
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
          <div style={{ border: '1px solid var(--border-hairline)', background: 'var(--bg-panel)', marginBottom: '2rem', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>

            {/* Frame header bar */}
            <div style={{
              background: 'var(--bg-sidebar)',
              padding: '1rem 1.25rem',
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              borderBottom: '1px solid var(--border-hairline)',
            }}>
              <FileText size={16} color="var(--accent-blue)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Báo Cáo Tổng Hợp
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Phân tích chi tiết sự khác biệt giữa hai phiên bản
              </span>
            </div>

            {/* ── SECTION: Thống kê ── */}
            <SectionLabel icon={Activity} label="Thống kê tổng quan" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <StatCard title="Tổng đoạn" value={summary.total_clauses_compared} variant="blue" />
              <StatCard title="Đã đối khớp" value={summary.matched_clauses} variant="blue" />
              <StatCard title="Không thay đổi" value={summary.unchanged_clauses} variant="green" />
              <StatCard title="Có thay đổi" value={summary.modified_clauses} variant="amber" />
              <StatCard title="Không xác định" value={summary.blocked_or_unsupported_clauses} variant="red" />
            </div>

            {/* Legend strip */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', padding: '0.875rem 1.25rem', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-hairline)', borderTop: '1px solid var(--border-hairline)' }}>
              {[
                { color: 'var(--ok-text)', label: 'Không thay đổi' },
                { color: 'var(--warn-text)', label: 'Có thay đổi' },
                { color: 'var(--accent-blue)', label: 'Thêm mới' },
                { color: 'var(--err-text)', label: 'Đã xóa' },
                { color: 'var(--text-muted)', label: 'Không xác định' },
              ].map(({ color, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  <span style={{ width: 8, height: 8, background: color, flexShrink: 0, borderRadius: '50%' }} />
                  {label}
                </span>
              ))}
            </div>

            {/* ── SECTION: Chi tiết ── */}
            <SectionLabel icon={FileText} label="Chi tiết điều khoản" count={details.length} />
            <div style={{ background: 'var(--bg-panel)' }}>
              {enrichedDetails.map((item, i) => (
                <ClauseDetail key={i} item={item} index={i + 1} />
              ))}
            </div>

            {/* Frame footer */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
              padding: '0.75rem 1.25rem',
              background: 'var(--bg-sidebar)',
              fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500,
            }}>
              <span>Báo cáo được tạo tự động bởi hệ thống phân tích</span>
              <span style={{ width: 4, height: 4, background: 'var(--border-hairline)', borderRadius: '50%' }} />
              <span>Thời gian xử lý: {duration_sec}s</span>
            </div>
          </div>
        </>
      ) : (
        <div style={{ marginTop: '0.5rem' }}>
          <Chatbot
            messages={chatMessages}
            setMessages={setChatMessages}
            conversationId={conversationId}
          />
        </div>
      )}
    </div>
  );
};

export default ReportView;