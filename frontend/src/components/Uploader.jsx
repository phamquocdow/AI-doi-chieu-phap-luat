import React, { useRef, useState } from 'react';
import { Upload, FileText, Trash2, Eye } from 'lucide-react';

const Uploader = ({ label, onFileChange, disabled, iconColor }) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.pdf') || file.name.endsWith('.docx'))) {
      setSelectedFile(file);
      onFileChange?.(file);
    }
  };
  const handleChange = (e) => {
    if (disabled || !e.target.files?.length) return;
    const file = e.target.files[0];
    setSelectedFile(file);
    onFileChange?.(file);
  };
  const handleRemove = (e) => {
    e.stopPropagation();
    setSelectedFile(null);
    onFileChange?.(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handlePreview = (e) => {
    e.stopPropagation();
    if (selectedFile) window.open(URL.createObjectURL(selectedFile), '_blank', 'noopener');
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const getExt = (name) => name.split('.').pop()?.toUpperCase() ?? '';
  
  const accentColor = iconColor || 'var(--accent-blue)';

  return (
    <div style={{ width: '100%', fontFamily: 'inherit' }}>
      {label && (
        <p style={{
          margin: '0 0 0.5rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}>
          {label}
        </p>
      )}

      {!selectedFile ? (
        /* ── Drop zone ── */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onMouseEnter={e => { if (!disabled && !isDragging) { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.background = 'var(--bg-elevated)'; } }}
          onMouseLeave={e => { if (!disabled && !isDragging) { e.currentTarget.style.borderColor = 'var(--border-hairline)'; e.currentTarget.style.background = 'var(--bg-panel)'; } }}
          style={{
            position: 'relative',
            border: `1.5px dashed ${disabled ? 'var(--border-hairline)' : isDragging ? accentColor : 'var(--border-strong)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            background: disabled ? 'var(--bg-main)' : isDragging ? 'var(--bg-hover)' : 'var(--bg-panel)',
            opacity: disabled ? 0.6 : 1,
            transition: 'background 0.15s, border-color 0.15s',
            boxSizing: 'border-box',
          }}
        >
          {/* top accent bar */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 2,
            background: disabled ? 'var(--border-hairline)' : accentColor,
            borderTopLeftRadius: 'var(--radius-sm)',
            borderTopRightRadius: 'var(--radius-sm)',
          }} />

          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.docx"
            onChange={handleChange}
            disabled={disabled}
            style={{ display: 'none' }}
          />

          {/* icon box */}
          <div style={{
            width: 48, height: 48,
            border: `1px solid ${disabled ? 'var(--border-hairline)' : accentColor}`,
            borderRadius: 'var(--radius-sm)',
            background: disabled ? 'var(--bg-main)' : 'var(--accent-blue-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Upload
              size={20}
              color={disabled ? 'var(--text-muted)' : accentColor}
              strokeWidth={1.5}
            />
          </div>

          {/* text */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>
              Kéo thả tệp vào đây hoặc{' '}
              <span style={{
                color: accentColor,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                fontWeight: 600,
              }}>
                chọn tệp
              </span>
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
              Hỗ trợ định dạng .PDF và .DOCX · Tối đa 20 MB
            </p>
          </div>

          {/* format badges */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            {['PDF', 'DOCX'].map((ext) => (
              <span key={ext} style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                padding: '0.3rem 0.6rem',
                background: 'var(--bg-main)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-sm)',
              }}>
                {ext}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* ── File selected ── */
        <div style={{
          position: 'relative',
          border: `1px solid ${accentColor}`,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-panel)',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}>
          {/* top accent bar */}
          <div style={{ height: 2, background: accentColor }} />

          <div style={{
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            {/* file icon */}
            <div style={{
              width: 36, height: 36, flexShrink: 0,
              border: `1px solid ${accentColor}`,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-blue-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <FileText size={16} color={accentColor} strokeWidth={1.5} />
            </div>

            {/* file info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: '0 0 2px',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'var(--text-main)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {selectedFile.name}
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {formatSize(selectedFile.size)} · {getExt(selectedFile.name)}
              </p>
            </div>

            {/* actions */}
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button
                title="Xem tệp"
                onClick={handlePreview}
                style={{
                  width: 28, height: 28,
                  border: '1px solid var(--border-hairline)',
                  background: 'var(--bg-main)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-main)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-hairline)'; }}
              >
                <Eye size={14} strokeWidth={1.5} />
              </button>
              <button
                onClick={handleRemove}
                title="Xóa tệp"
                style={{
                  width: 28, height: 28,
                  border: '1px solid var(--border-hairline)',
                  background: 'var(--bg-main)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--err-text)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--err-bg)'; e.currentTarget.style.borderColor = 'var(--err-text)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-main)'; e.currentTarget.style.borderColor = 'var(--border-hairline)'; }}
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* full progress bar */}
          <div style={{ height: 1, background: 'var(--border-hairline)' }}>
            <div style={{ width: '100%', height: '100%', background: accentColor }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Uploader;