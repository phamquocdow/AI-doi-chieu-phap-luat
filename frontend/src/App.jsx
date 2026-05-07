import React, { useState } from 'react';
import axios from 'axios';
import { Layers, Activity, FileText, CheckCircle2 } from 'lucide-react';
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
          setFile2Status({ uploading: false, done: false, pdf_url: null, filename: null }); // Reset file 2
        } else {
          setFile2Status({ uploading: false, done: true, pdf_url: response.data.pdf_url, filename: file.name });
        }
      } else {
        throw new Error(response.data.detail || "Lỗi upload");
      }
    } catch (err) {
      if (slot === 'file_1') setFile1Status({ uploading: false, done: false, pdf_url: null, filename: null });
      else setFile2Status({ uploading: false, done: false, pdf_url: null, filename: null });
      setError(err.response?.data?.detail || err.message || 'Lỗi kết nối đến server.');
    }
  };

  const handleCompare = async () => {
    if (!file1Status.done || !file2Status.done) {
      setError('Vui lòng upload hoàn tất cả 2 file để so sánh.');
      return;
    }

    setComparing(true);
    setError('');

    try {
      // Gọi API so sánh, không cần gửi file vì đã lưu state ở backend (Qdrant)
      const response = await axios.post('http://localhost:8000/api/compare');
      if (response.data.success) {
        setReport({
          ...response.data,
          pdf_url_a: file1Status.pdf_url,
          pdf_url_b: file2Status.pdf_url
        });
      } else {
        setError('Có lỗi xảy ra trong quá trình so sánh.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Lỗi kết nối đến server.');
    } finally {
      setComparing(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setFile1Status({ uploading: false, done: false, pdf_url: null, filename: null });
    setFile2Status({ uploading: false, done: false, pdf_url: null, filename: null });
    setError('');
  };

  return (
    <div className="container animate-fade-in">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--brand-gradient)', padding: '10px', borderRadius: '10px', display: 'flex' }}>
            <Layers color="white" size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', margin: 0 }}>
              <span className="text-gradient">Legal</span> Compare AI
            </h1>
            <p className="text-muted" style={{ fontSize: '0.95rem', marginTop: '0.1rem' }}>
              Đối chiếu văn bản pháp lý tự động & Trực quan
            </p>
          </div>
        </div>
      </header>

      {!report && (
        <div className="glass-panel animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} className="text-muted" />
            Tải lên văn bản theo thứ tự
          </h2>

          <div className="upload-panels">
            {/* FILE 1 */}
            <div className={`upload-panel`}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="step-num">1</span>
                Bản cũ (File 1)
              </h3>
              {!file1Status.done ? (
                <Uploader
                  label="Chọn File 1 (DOCX, PDF)"
                  disabled={file1Status.uploading}
                  onFileChange={(f) => handleUpload(f, 'file_1')}
                  iconColor="#4f46e5"
                />
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                      <CheckCircle2 size={16} color="var(--ok)"/>
                      <span style={{ wordBreak: 'break-all' }}>{file1Status.filename}</span>
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      onClick={() => setFile1Status({ uploading: false, done: false, pdf_url: null, filename: null })}
                    >
                      Xóa
                    </button>
                  </div>
                  {file1Status.pdf_url && (
                    <div style={{ height: '350px', border: '1px solid rgba(79,70,229,0.25)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                      <iframe src={`http://localhost:8000${file1Status.pdf_url}`} width="100%" height="100%" style={{ border: 'none', background: 'transparent' }} title="PDF 1" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* FILE 2 */}
            <div className={`upload-panel ${file1Status.done ? '' : 'disabled'}`}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="step-num" style={{ background: file1Status.done ? '#a78bfa' : '#666' }}>2</span>
                Bản mới (File 2)
              </h3>
              {!file2Status.done ? (
                <Uploader
                  label={file1Status.done ? "Chọn File 2 (DOCX, PDF)" : "Chờ xử lý xong File 1"}
                  disabled={file2Status.uploading || !file1Status.done}
                  onFileChange={(f) => handleUpload(f, 'file_2')}
                  iconColor={file1Status.done ? "#a78bfa" : "#666"}
                />
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                      <CheckCircle2 size={16} color="var(--ok)"/>
                      <span style={{ wordBreak: 'break-all' }}>{file2Status.filename}</span>
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      onClick={() => setFile2Status({ uploading: false, done: false, pdf_url: null, filename: null })}
                    >
                      Xóa
                    </button>
                  </div>
                  {file2Status.pdf_url && (
                    <div style={{ height: '350px', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                      <iframe src={`http://localhost:8000${file2Status.pdf_url}`} width="100%" height="100%" style={{ border: 'none', background: 'transparent' }} title="PDF 2" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '1rem 3rem', fontSize: '1.125rem', borderRadius: '9999px', opacity: (file1Status.done && file2Status.done) ? 1 : 0.5 }}
              onClick={handleCompare}
              disabled={comparing || !file1Status.done || !file2Status.done}
            >
              {comparing ? (
                <>
                  <Activity size={20} className="spin inline-icon" />
                  Đang phân tích LLM...
                </>
              ) : (
                'Bắt đầu so sánh'
              )}
            </button>
          </div>
        </div>
      )}

      {report && <ReportView data={report} onReset={handleReset} />}

      {/* Loading Overlay Popup */}
      {(file1Status.uploading || file2Status.uploading || comparing) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border)',
            padding: '2rem 3rem', borderRadius: '1rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            textAlign: 'center'
          }}>
            <Activity size={48} color="var(--brand)" className="spin" style={{ marginBottom: '1rem' }} />
            <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>Đang xử lý hệ thống...</h3>
            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem', maxWidth: '250px' }}>
              {comparing 
                ? 'Đang so sánh ngữ nghĩa và tổng hợp báo cáo bằng AI...'
                : 'Đang tải file, chuẩn hóa văn bản, chia đoạn và nhúng vector...'}
            </p>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 2s linear infinite; }
        .inline-icon { display: inline-block; vertical-align: middle; margin-right: 4px; margin-top: -2px; }
      ` }} />
    </div>
  );
}

export default App;
