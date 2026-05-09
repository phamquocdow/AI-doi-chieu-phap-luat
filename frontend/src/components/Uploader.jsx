import React, { useRef } from 'react';
import { UploadCloud } from 'lucide-react';

const Uploader = ({ label, onFileChange, iconColor = '#1d4ed8', disabled }) => {
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) e.currentTarget.classList.add('lc-uploader-drag');
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('lc-uploader-drag');
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('lc-uploader-drag');
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.pdf') || file.name.endsWith('.docx'))) {
      onFileChange(file);
    }
  };
  const handleChange = (e) => {
    if (disabled || !e.target.files?.length) return;
    onFileChange(e.target.files[0]);
  };

  return (
    <div
      className="lc-uploader"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      style={{ opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,.docx"
        onChange={handleChange}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      <div className="lc-uploader-icon-wrap" style={{ borderColor: iconColor + '40', background: iconColor + '12' }}>
        <UploadCloud size={28} color={iconColor} />
      </div>
      <p className="lc-uploader-cta">Kéo thả hoặc <span style={{ color: iconColor, fontWeight: 700 }}>chọn file</span></p>
      <p className="lc-uploader-hint">Hỗ trợ .pdf, .docx</p>

      <style>{`
        .lc-uploader {
          border: 2px dashed #bfdbfe;
          border-radius: 1rem;
          padding: 2.25rem 1.5rem;
          display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
          cursor: pointer; transition: border-color 0.2s, background 0.2s;
          background: #f8fbff;
          text-align: center;
        }
        .lc-uploader:hover, .lc-uploader-drag {
          border-color: #1d4ed8 !important; background: #eff6ff !important;
        }
        .lc-uploader-icon-wrap {
          width: 58px; height: 58px; border-radius: 50%;
          border: 2px solid; display: flex; align-items: center; justify-content: center;
          margin-bottom: 0.25rem;
        }
        .lc-uploader-cta { font-size: 0.95rem; color: #334155; font-weight: 500; }
        .lc-uploader-hint { font-size: 0.78rem; color: #94a3b8; }
      `}</style>
    </div>
  );
};

export default Uploader;
