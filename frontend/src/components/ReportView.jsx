import React, { useState, useMemo } from 'react';
import {
  ArrowLeft, CheckCircle, AlertTriangle, XCircle, PlusCircle, Trash2,
  ChevronDown, ChevronUp, Clock, GitCompare, FileText, BarChart2, MessageSquare
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
      matrix[i][j] = a[i-1] === b[j-1] ? matrix[i-1][j-1]+1 : Math.max(matrix[i-1][j], matrix[i][j-1]);
  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i-1] === b[j-1]) { result.unshift({ type: 'equal', value: a[i-1] }); i--; j--; }
    else if (matrix[i-1][j] >= matrix[i][j-1]) { result.unshift({ type: 'delete', value: a[i-1] }); i--; }
    else { result.unshift({ type: 'insert', value: b[j-1] }); j--; }
  }
  while (i > 0) { result.unshift({ type: 'delete', value: a[i-1] }); i--; }
  while (j > 0) { result.unshift({ type: 'insert', value: b[j-1] }); j--; }
  return result;
}

const DiffPanel = ({ textA, textB, side }) => {
  const diff = useMemo(() => lcs(tokenize(textA || ''), tokenize(textB || '')), [textA, textB]);
  const hasChanges = diff.some(d => d.type !== 'equal');

  return (
    <div className={`lc-diff-box ${side === 'a' ? 'lc-diff-a' : 'lc-diff-b'}`}>
      {!hasChanges
        ? <span className="lc-diff-unchanged">{textA || textB || <em style={{ color: '#94a3b8' }}>Không có nội dung.</em>}</span>
        : diff.map((token, idx) => {
            if (token.type === 'equal') return <span key={idx}>{token.value}</span>;
            if (side === 'a' && token.type === 'delete')
              return <mark key={idx} className="lc-mark-del">{token.value}</mark>;
            if (side === 'b' && token.type === 'insert')
              return <mark key={idx} className="lc-mark-ins">{token.value}</mark>;
            return null;
          })
      }
    </div>
  );
};

// ── Summary stat card ────────────────────────────────────────────────────────
const StatCard = ({ title, value, variant }) => {
  const palette = {
    blue:   { bg: '#eff6ff', border: '#bfdbfe', val: '#1d4ed8' },
    green:  { bg: '#f0fdf4', border: '#bbf7d0', val: '#16a34a' },
    amber:  { bg: '#fffbeb', border: '#fde68a', val: '#d97706' },
    red:    { bg: '#fef2f2', border: '#fecaca', val: '#dc2626' },
  };
  const c = palette[variant] || palette.blue;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '0.875rem', padding: '1.25rem 1.5rem' }}>
      <p style={{ font: '600 0.72rem/1 Segoe UI,sans-serif', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>{title}</p>
      <p style={{ font: `800 2.25rem/1 Segoe UI,sans-serif`, color: c.val }}>{value}</p>
    </div>
  );
};

// ── Clause detail row ────────────────────────────────────────────────────────
const STATUS = {
  unchanged: { cls: 'lc-badge-green',  Icon: CheckCircle,  label: 'Không đổi' },
  modified:  { cls: 'lc-badge-amber',  Icon: AlertTriangle, label: 'Có thay đổi' },
  added:     { cls: 'lc-badge-blue',   Icon: PlusCircle,   label: 'Thêm mới' },
  deleted:   { cls: 'lc-badge-red',    Icon: Trash2,       label: 'Đã xóa' },
  blocked:   { cls: 'lc-badge-red',    Icon: XCircle,      label: 'Không xác định' },
};
const IMP = {
  high:   { cls: 'lc-badge-red',   label: '🔴 Quan trọng' },
  medium: { cls: 'lc-badge-amber', label: '🟡 Trung bình' },
  low:    { cls: 'lc-badge-blue',  label: '🔵 Thấp' },
};

const ClauseDetail = ({ item, index }) => {
  const [expanded, setExpanded] = useState(false);
  const [diffMode, setDiffMode] = useState(true);
  const st = STATUS[item.clause_change_type] || STATUS.blocked;
  const imp = IMP[item.importance] || IMP.medium;
  const isUnchanged = item.clause_change_type === 'unchanged';

  return (
    <div className={`lc-clause ${expanded ? 'lc-clause-open' : ''}`}>
      {/* Row header */}
      <div className="lc-clause-header" onClick={() => setExpanded(e => !e)}>
        <span className="lc-clause-num">{index}</span>
        <div className="lc-clause-meta">
          <span className="lc-clause-title">{item.clause_title || `Điều khoản ${index}`}</span>
          <div className="lc-clause-badges">
            <span className={`lc-badge ${st.cls}`}>
              <st.Icon size={11} /> {st.label}
            </span>
            {!isUnchanged && (
              <span className={`lc-badge ${imp.cls}`}>{imp.label}</span>
            )}
          </div>
        </div>
        <span className="lc-clause-chevron">
          {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="lc-clause-body">
          {item.summary && (
            <div className="lc-clause-summary">
              <strong>Tóm tắt thay đổi:</strong> {item.summary}
            </div>
          )}

          {(item.content_a || item.content_b) && (
            <>
              <div className="lc-diff-toolbar">
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>So sánh nội dung</span>
                <button
                  onClick={() => setDiffMode(m => !m)}
                  className={`lc-toggle-btn ${diffMode ? 'lc-toggle-on' : ''}`}
                >
                  <GitCompare size={12} />
                  {diffMode ? 'Đang highlight' : 'Highlight thay đổi'}
                </button>
              </div>

              <div className="lc-diff-cols">
                {/* Side A */}
                <div>
                  <div className="lc-diff-side-label lc-side-a-label">
                    <span className="lc-dot lc-dot-a" /> Bản cũ
                  </div>
                  {diffMode
                    ? <DiffPanel textA={item.content_a} textB={item.content_b} side="a" />
                    : <div className="lc-diff-box lc-diff-a lc-diff-plain">{item.content_a || <em style={{ color: '#94a3b8' }}>Không có nội dung.</em>}</div>
                  }
                  {item.citations_a?.length > 0 && (
                    <div className="lc-cit-box lc-cit-a">
                      <strong>Từ khóa bị xóa / thay đổi:</strong>
                      <ul>{item.citations_a.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  )}
                </div>

                {/* Side B */}
                <div>
                  <div className="lc-diff-side-label lc-side-b-label">
                    <span className="lc-dot lc-dot-b" /> Bản mới
                  </div>
                  {diffMode
                    ? <DiffPanel textA={item.content_a} textB={item.content_b} side="b" />
                    : <div className="lc-diff-box lc-diff-b lc-diff-plain">{item.content_b || <em style={{ color: '#94a3b8' }}>Không có nội dung tương ứng.</em>}</div>
                  }
                  {item.citations_b?.length > 0 && (
                    <div className="lc-cit-box lc-cit-b">
                      <strong>Từ khóa được thêm / mới:</strong>
                      <ul>{item.citations_b.map((c, i) => <li key={i}>{c}</li>)}</ul>
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

// ── Main report view ─────────────────────────────────────────────────────────
const ReportView = ({ data, onReset }) => {
  const { report, duration_sec, pdf_url_a, pdf_url_b } = data;
  const { summary, details } = report;
  const [activeTab, setActiveTab] = useState('report');

  return (
    <div className="lc-report">
      {/* Top bar */}
      <div className="lc-report-topbar">
        <div>
          <h2 className="lc-report-title">Kết quả Đối chiếu</h2>
          <span className="lc-report-time"><Clock size={13} /> Phân tích hoàn tất trong {duration_sec}s</span>
        </div>
        <button className="lc-back-btn" onClick={onReset}>
          <ArrowLeft size={16} /> So sánh mới
        </button>
      </div>

      {/* Tabs */}
      <div className="lc-tabs">
        <button className={`lc-tab ${activeTab === 'report' ? 'lc-tab-active' : ''}`} onClick={() => setActiveTab('report')}>
          <BarChart2 size={16} /> Báo cáo Đối chiếu
        </button>
        <button className={`lc-tab ${activeTab === 'chat' ? 'lc-tab-active' : ''}`} onClick={() => setActiveTab('chat')}>
          <MessageSquare size={16} /> Trợ lý AI Hỏi đáp
        </button>
      </div>

      {activeTab === 'report' ? (
        <>
          {/* PDF viewer */}
          <div className="lc-section">
            <DocumentPaperView
              pdfUrlA={pdf_url_a ? `http://localhost:8000${pdf_url_a}` : null}
              pdfUrlB={pdf_url_b ? `http://localhost:8000${pdf_url_b}` : null}
              details={details}
            />
          </div>

          {/* Stats */}
          <div className="lc-stats-grid lc-section">
            <StatCard title="Tổng đoạn" value={summary.total_clauses_compared} variant="blue" />
            <StatCard title="Đã đối khớp" value={summary.matched_clauses} variant="blue" />
            <StatCard title="Không thay đổi" value={summary.unchanged_clauses} variant="green" />
            <StatCard title="Có thay đổi" value={summary.modified_clauses} variant="amber" />
            <StatCard title="Không xác định" value={summary.blocked_or_unsupported_clauses} variant="red" />
          </div>

          {/* Details */}
          <div className="lc-section lc-report-card">
            <div className="lc-report-card-header">
              <FileText size={18} />
              <h3>Chi tiết từng điều khoản</h3>
              <span className="lc-count-badge">{details.length} mục</span>
            </div>
            <div className="lc-clauses-list">
              {details.map((item, i) => (
                <ClauseDetail key={i} item={item} index={i + 1} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="lc-section"><Chatbot /></div>
      )}

      <style>{`
        .lc-report { display: flex; flex-direction: column; gap: 0; }

        .lc-report-topbar {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap;
        }
        .lc-report-title { font-size: 1.6rem; font-weight: 800; color: #0f2545; margin: 0 0 0.25rem; }
        .lc-report-time { display: flex; align-items: center; gap: 0.3rem; font-size: 0.82rem; color: #64748b; }
        .lc-back-btn {
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.6rem 1.25rem; border-radius: 9999px;
          background: #fff; border: 1.5px solid #bfdbfe; color: #1d4ed8;
          font-size: 0.88rem; font-weight: 700; cursor: pointer;
          transition: all 0.15s;
        }
        .lc-back-btn:hover { background: #eff6ff; }

        .lc-tabs {
          display: flex; gap: 0; border-bottom: 2px solid #dbeafe;
          margin-bottom: 1.75rem;
        }
        .lc-tab {
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.85rem 1.75rem; border: none; background: transparent;
          font-size: 0.95rem; font-weight: 600; color: #64748b; cursor: pointer;
          border-bottom: 2.5px solid transparent; margin-bottom: -2px;
          transition: all 0.15s;
        }
        .lc-tab:hover { color: #1d4ed8; }
        .lc-tab-active { color: #1d4ed8; border-bottom-color: #1d4ed8; }

        .lc-section { margin-bottom: 1.75rem; }

        .lc-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 1rem;
        }

        .lc-report-card {
          background: #fff; border: 1px solid #dbeafe;
          border-radius: 1.25rem; overflow: hidden;
          box-shadow: 0 2px 12px rgba(30,64,175,.06);
        }
        .lc-report-card-header {
          display: flex; align-items: center; gap: 0.65rem;
          padding: 1.25rem 1.5rem;
          background: linear-gradient(135deg,#eff6ff,#f0f9ff);
          border-bottom: 1px solid #dbeafe; color: #1d4ed8;
        }
        .lc-report-card-header h3 { font-size: 1.05rem; font-weight: 700; color: #0f2545; margin: 0; }
        .lc-count-badge {
          margin-left: auto; background: #dbeafe; color: #1d4ed8;
          font-size: 0.78rem; font-weight: 700; padding: 0.2rem 0.65rem;
          border-radius: 20px;
        }
        .lc-clauses-list { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }

        /* ── Clause card ── */
        .lc-clause {
          border: 1px solid #e2e8f0; border-radius: 0.875rem;
          overflow: hidden; background: #fff; transition: box-shadow 0.2s;
        }
        .lc-clause-open { box-shadow: 0 4px 20px rgba(30,64,175,.1); border-color: #bfdbfe; }
        .lc-clause-header {
          display: flex; align-items: center; gap: 0.875rem;
          padding: 1rem 1.25rem; cursor: pointer;
          transition: background 0.15s;
        }
        .lc-clause-header:hover { background: #f8fbff; }
        .lc-clause-num {
          width: 26px; height: 26px; border-radius: 50%;
          background: #eff6ff; color: #1d4ed8;
          font-size: 0.78rem; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lc-clause-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.35rem; }
        .lc-clause-title { font-size: 0.95rem; font-weight: 600; color: #0f2545; }
        .lc-clause-badges { display: flex; gap: 0.4rem; flex-wrap: wrap; }
        .lc-clause-chevron { color: #94a3b8; flex-shrink: 0; }

        /* Badges */
        .lc-badge {
          display: inline-flex; align-items: center; gap: 0.3rem;
          font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.6rem;
          border-radius: 20px;
        }
        .lc-badge-green { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .lc-badge-amber { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
        .lc-badge-blue  { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .lc-badge-red   { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

        /* Clause body */
        .lc-clause-body { padding: 1.25rem 1.5rem; border-top: 1px solid #dbeafe; background: #f8fbff; }
        .lc-clause-summary {
          background: #eff6ff; border: 1px solid #bfdbfe;
          border-radius: 0.6rem; padding: 0.875rem 1rem;
          font-size: 0.88rem; color: #1e3a6e; line-height: 1.6;
          margin-bottom: 1.25rem;
        }
        .lc-diff-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 0.875rem;
        }
        .lc-toggle-btn {
          display: inline-flex; align-items: center; gap: 0.3rem;
          padding: 0.28rem 0.75rem; border-radius: 20px; cursor: pointer;
          font-size: 0.75rem; font-weight: 700; transition: all 0.15s;
          border: 1px solid #dbeafe; background: #fff; color: #64748b;
        }
        .lc-toggle-on { background: #eff6ff; border-color: #93c5fd; color: #1d4ed8; }

        .lc-diff-cols {
          display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;
        }
        .lc-diff-side-label {
          display: flex; align-items: center; gap: 0.4rem;
          font-size: 0.82rem; font-weight: 700; margin-bottom: 0.5rem;
        }
        .lc-side-a-label { color: #dc2626; }
        .lc-side-b-label { color: #1d4ed8; }
        .lc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .lc-dot-a { background: #dc2626; }
        .lc-dot-b { background: #1d4ed8; }

        .lc-diff-box {
          padding: 1rem 1.1rem; border-radius: 0.6rem;
          font-size: 0.88rem; line-height: 1.85; white-space: pre-wrap;
          max-height: 300px; overflow-y: auto;
        }
        .lc-diff-a { background: rgba(220,38,38,.04); border: 1px solid rgba(220,38,38,.18); color: #1e293b; }
        .lc-diff-b { background: rgba(29,78,216,.04); border: 1px solid rgba(29,78,216,.18); color: #1e293b; }
        .lc-diff-plain { background: rgba(0,0,0,.02); }
        .lc-diff-unchanged { color: #64748b; }

        .lc-mark-del {
          background: rgba(239,68,68,.13); color: #b91c1c;
          text-decoration: line-through; text-decoration-color: #ef4444;
          border-radius: 3px; padding: 0 2px;
        }
        .lc-mark-ins {
          background: rgba(29,78,216,.12); color: #1d4ed8;
          border-radius: 3px; padding: 0 2px;
        }

        .lc-cit-box {
          margin-top: 0.75rem; padding: 0.75rem 1rem;
          border-radius: 0.5rem; font-size: 0.82rem; line-height: 1.6;
        }
        .lc-cit-a { background: rgba(220,38,38,.05); border: 1px solid rgba(220,38,38,.15); color: #991b1b; }
        .lc-cit-b { background: rgba(29,78,216,.05); border: 1px solid rgba(29,78,216,.15); color: #1e40af; }
        .lc-cit-box ul { padding-left: 1.2rem; margin-top: 0.35rem; }
        .lc-cit-box strong { font-weight: 700; }
      `}</style>
    </div>
  );
};

export default ReportView;
