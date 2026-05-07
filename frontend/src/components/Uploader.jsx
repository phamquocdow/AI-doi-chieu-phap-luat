import React, { useRef } from 'react';
import { UploadCloud } from 'lucide-react';

const Uploader = ({ label, onFileChange, iconColor, disabled }) => {
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) e.currentTarget.classList.add('active');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('active');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('active');
    if (disabled) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.pdf') || droppedFile.name.endsWith('.docx')) {
        onFileChange(droppedFile);
      }
    }
  };

  const handleChange = (e) => {
    if (disabled) return;
    if (e.target.files && e.target.files.length > 0) {
      onFileChange(e.target.files[0]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <label style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-secondary)' }}>
        {label}
      </label>

      <div
        className="uploader-area"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input type="file" ref={fileInputRef} accept=".pdf,.docx" onChange={handleChange} disabled={disabled} />
        <UploadCloud size={48} className="uploader-icon" color={iconColor} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Kéo thả hoặc Click</h3>
        <p className="text-muted text-sm">Hỗ trợ .pdf, .docx</p>
      </div>
    </div>
  );
};

export default Uploader;
