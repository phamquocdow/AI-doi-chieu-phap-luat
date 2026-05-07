import { useState } from 'react';
import { ArrowLeft, CheckCircle, AlertTriangle, Info, XCircle, PlusCircle, Trash2, ChevronDown, ChevronUp, Clock } from 'lucide-react';

const SummaryCard = ({ title, value, type }) => {
  const colors = {
    info: { c: 'var(--brand)', bg: 'rgba(59, 130, 246, 0.1)' },
    ok: { c: 'var(--ok)', bg: 'var(--ok-bg)' },
    warn: { c: 'var(--warn)', bg: 'var(--warn-bg)' },
    danger: { c: 'var(--danger)', bg: 'var(--danger-bg)' },
  };
  const { c, bg } = colors[type] || colors.info;

  return (
    <div
      style={{
        background: 'var(--bg-glass)',
        border: `1px solid ${c}`,
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        boxShadow: `0 4px 20px ${bg}`,
      }}
    >
      <div className="text-muted text-sm font-bold" style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      <div style={{ fontSize: '2.5rem', fontWeight: 800, color: c, lineHeight: 1 }}>{value}</div>
    </div>
  );
};

const statusConfig = {
  unchanged: { badge: 'badge-ok', icon: CheckCircle, label: 'Giống nhau' },
  modified: { badge: 'badge-warn', icon: AlertTriangle, label: 'Có thay đổi' },
  added: { badge: 'badge-info', icon: PlusCircle, label: 'Thêm mới' },
  deleted: { badge: 'badge-danger', icon: Trash2, label: 'Bị xóa' },
  blocked: { badge: 'badge-danger', icon: XCircle, label: 'Không xác định' },
};

const importanceConfig = {
  high: { badge: 'badge-danger', label: 'Quan trọng' },
  medium: { badge: 'badge-warn', label: 'Trung bình' },
  low: { badge: 'badge-info', label: 'Thấp' },
};

const ClauseDetail = ({ item, index }) => {
  const [expanded, setExpanded] = useState(false);

  const st = statusConfig[item.clause_change_type] || statusConfig.blocked;
  const StatusIcon = st.icon;
  const imp = importanceConfig[item.importance] || importanceConfig.medium;

  return (
    <div
      style={{
        background: 'var(--bg-glass)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '1rem',
        overflow: 'hidden',
        boxShadow: expanded ? '0 8px 30px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease'
      }}
    >
      <div
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          background: expanded ? 'rgba(255,255,255,0.05)' : 'transparent',
          transition: 'background 0.2s',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>
            {index}. {item.section_title_a || `Đoạn ${item.source_clause_no}`}
          </div>
          <span className={`badge ${st.badge}`} style={{ fontSize: '0.9rem', padding: '0.35rem 0.75rem' }}>
            <StatusIcon size={13} style={{ marginRight: 4 }} />
            {st.label}
          </span>
          <span className={`badge ${imp.badge}`}>{imp.label}</span>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </div>

      {expanded && (
        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)' }} className="animate-fade-in">
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.08)',
              borderLeft: '4px solid var(--brand)',
              padding: '1rem 1.5rem',
              borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
              marginBottom: '1.5rem',
            }}
          >
            <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
              <Info size={20} color="var(--brand)" />
              Kết luận AI
            </strong>
            <p style={{ margin: 0, lineHeight: 1.6, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{item.summary}</p>
          </div>

          <div className="grid-2" style={{ gap: '1.5rem' }}>
            <div>
              <h4 style={{ marginBottom: '0.75rem', color: '#3b82f6', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></span>
                Văn bản 1
              </h4>
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  fontSize: '1rem',
                  lineHeight: 1.6,
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: 'var(--text-secondary)'
                }}
              >
                {item.content_a || <span className="text-muted">Không có nội dung.</span>}
              </div>
              {item.citations_a && item.citations_a.length > 0 && (
                <div style={{ marginTop: '1rem', background: 'rgba(59, 130, 246, 0.05)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <strong className="text-sm" style={{ color: '#3b82f6' }}>Từ khóa bị xóa/đổi:</strong>
                  <ul style={{ fontSize: '0.9rem', paddingLeft: '1.25rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                    {item.citations_a.map((cit, i) => (
                      <li key={i}>{cit}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <h4 style={{ marginBottom: '0.75rem', color: '#8b5cf6', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6' }}></span>
                Văn bản 2
              </h4>
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  fontSize: '1rem',
                  lineHeight: 1.6,
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  color: 'var(--text-secondary)'
                }}
              >
                {item.content_b || <span className="text-muted">Không có nội dung tương ứng.</span>}
              </div>
              {item.citations_b && item.citations_b.length > 0 && (
                <div style={{ marginTop: '1rem', background: 'rgba(139, 92, 246, 0.05)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <strong className="text-sm" style={{ color: '#8b5cf6' }}>Từ khóa được thêm/mới:</strong>
                  <ul style={{ fontSize: '0.9rem', paddingLeft: '1.25rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                    {item.citations_b.map((cit, i) => (
                      <li key={i}>{cit}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import PdfViewer from './PdfViewer';

const ReportView = ({ data, onReset }) => {
  const { report, duration_sec, pdf_url_a, pdf_url_b } = data;
  const { summary, details } = report;

  // Build highlight lists: prefer explicit citation keywords, otherwise use short snippet
  const highlightsA = details.flatMap((item) => {
    if (item.citations_a && item.citations_a.length) return item.citations_a;
    if (item.content_a) return [item.content_a.slice(0, 200)];
    return [];
  });

  const highlightsB = details.flatMap((item) => {
    if (item.citations_b && item.citations_b.length) return item.citations_b;
    if (item.content_b) return [item.content_b.slice(0, 200)];
    return [];
  });

  return (
    <div className="animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h2>Kết quả đối chiếu</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="text-muted text-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Clock size={14} />
            {duration_sec}s
          </span>
          <button className="btn btn-secondary" onClick={onReset}>
            <ArrowLeft size={18} /> So sánh mới
          </button>
        </div>
      </div>

      <div id="view-compare" className="compare-layout" style={{ marginBottom: '1.5rem' }}>
        <div className="pdf-container">
          <div className="pdf-header">
            <div style={{ fontWeight: 700, color: 'var(--brand)' }}>Bản cũ (File 1)</div>
            <div style={{ marginLeft: 'auto' }} className="pdf-controls"></div>
          </div>
          <div className="pdf-wrapper" style={{ height: 520 }}>
            {pdf_url_a ? (
              <PdfViewer url={`http://localhost:8000${pdf_url_a}`} highlights={highlightsA} highlightColor={'rgba(255,245,157,0.28)'} />
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Không có Preview</div>
            )}
          </div>
        </div>

        <div className="pdf-container">
          <div className="pdf-header">
            <div style={{ fontWeight: 700, color: '#a78bfa' }}>Bản mới (File 2)</div>
            <div style={{ marginLeft: 'auto' }} className="pdf-controls"></div>
          </div>
          <div className="pdf-wrapper" style={{ height: 520 }}>
            {pdf_url_b ? (
              <PdfViewer url={`http://localhost:8000${pdf_url_b}`} highlights={highlightsB} highlightColor={'rgba(251,207,232,0.25)'} />
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Không có Preview</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <SummaryCard title="Tổng đoạn" value={summary.total_clauses_compared} type="info" />
        <SummaryCard title="Đã đối khớp" value={summary.matched_clauses} type="info" />
        <SummaryCard title="Giống nhau" value={summary.unchanged_clauses} type="ok" />
        <SummaryCard title="Có thay đổi" value={summary.modified_clauses} type="warn" />
        <SummaryCard title="Không xác định" value={summary.blocked_or_unsupported_clauses} type="danger" />
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.25rem' }}>Chi tiết đối chiếu</h3>
        {details.map((item, index) => (
          <ClauseDetail key={index} item={item} index={index + 1} />
        ))}
      </div>
    </div>
  );
};

export default ReportView;
