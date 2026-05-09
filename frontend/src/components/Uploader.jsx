import React, { useRef, useState } from 'react';
import { Upload, FileText, Trash2, Eye } from 'lucide-react';

const Uploader = ({ label, onFileChange, disabled }) => {
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

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const getExt = (name) => name.split('.').pop()?.toUpperCase() ?? '';

  return (
    <div style={{ width: '100%', fontFamily: 'inherit' }}>
      {label && (
        <p style={{
          margin: '0 0 0.5rem',
          fontSize: '13px',
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#5F5E5A',
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
          style={{
            position: 'relative',
            border: `1.5px dashed ${disabled ? '#D3D1C7' : isDragging ? '#185FA5' : '#185FA5'}`,
            borderRadius: 0,
            padding: '3rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            background: disabled ? '#f5f5f4' : isDragging ? '#E6F1FB' : '#ffffff',
            opacity: disabled ? 0.6 : 1,
            transition: 'background 0.15s, border-color 0.15s',
            boxSizing: 'border-box',
          }}
        >
          {/* top accent bar */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 3,
            background: disabled ? '#B4B2A9' : '#185FA5',
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
            width: 60, height: 60,
            border: `1.5px solid ${disabled ? '#B4B2A9' : '#185FA5'}`,
            borderRadius: 0,
            background: disabled ? '#D3D1C7' : '#E6F1FB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Upload
              size={26}
              color={disabled ? '#5F5E5A' : '#185FA5'}
              strokeWidth={1.75}
            />
          </div>

          {/* text */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 500, color: '#0C447C' }}>
              Kéo thả tệp vào đây hoặc{' '}
              <span style={{
                color: '#185FA5',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}>
                chọn tệp
              </span>
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#888780', letterSpacing: '0.04em' }}>
              Hỗ trợ định dạng .PDF và .DOCX · Tối đa 20 MB
            </p>
          </div>

          {/* format badges */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {['PDF', 'DOCX'].map((ext) => (
              <span key={ext} style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.07em',
                padding: '3px 10px',
                background: '#E6F1FB',
                color: '#0C447C',
                border: '1px solid #185FA5',
                borderRadius: 0,
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
          border: '1.5px solid #185FA5',
          borderRadius: 0,
          background: '#ffffff',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}>
          {/* top accent bar */}
          <div style={{ height: 3, background: '#185FA5' }} />

          <div style={{
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            {/* file icon */}
            <div style={{
              width: 44, height: 44, flexShrink: 0,
              border: '1.5px solid #185FA5',
              borderRadius: 0,
              background: '#E6F1FB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <FileText size={22} color="#185FA5" strokeWidth={1.75} />
            </div>

            {/* file info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: '0 0 2px',
                fontSize: 14,
                fontWeight: 500,
                color: '#0C447C',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {selectedFile.name}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#888780' }}>
                {formatSize(selectedFile.size)} · {getExt(selectedFile.name)}
              </p>
            </div>

            {/* actions */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                title="Xem tệp"
                style={{
                  width: 32, height: 32,
                  border: '1px solid #185FA5',
                  background: '#E6F1FB',
                  borderRadius: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#185FA5',
                }}
              >
                <Eye size={16} strokeWidth={1.75} />
              </button>
              <button
                onClick={handleRemove}
                title="Xóa tệp"
                style={{
                  width: 32, height: 32,
                  border: '1px solid #A32D2D',
                  background: '#FCEBEB',
                  borderRadius: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#A32D2D',
                }}
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* full progress bar */}
          <div style={{ height: 2, background: '#B5D4F4' }}>
            <div style={{ width: '100%', height: '100%', background: '#185FA5' }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Uploader;