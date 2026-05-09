import React, { useState, useRef, useEffect } from 'react';
import { User, ArrowUp } from 'lucide-react';

const renderMarkdown = (text) => {
  if (!text) return null;
  return text.split('\n').map((line, index) => {
    if (!line.trim()) return <div key={index} style={{ height: 8 }} />;
    if (line.trim().startsWith('#')) {
      const content = line.replace(/^#+\s*/, '');
      return (
        <div key={index} style={{
          fontSize: '0.88rem', fontWeight: 800, color: '#0A1628',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          margin: '14px 0 6px', borderBottom: '2px solid #1B4FD8',
          paddingBottom: 4, display: 'inline-block',
        }}>{content}</div>
      );
    }
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const isStandaloneBold = parts.length === 3 && parts[0].trim() === '' && parts[2].trim() === '';
    return (
      <div key={index} style={{ marginBottom: 5, lineHeight: 1.65 }}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const inner = part.slice(2, -2);
            if (isStandaloneBold) {
              return (
                <div key={i} style={{
                  fontSize: '0.85rem', fontWeight: 800, color: '#0A1628',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  margin: '10px 0 6px', borderLeft: '3px solid #1B4FD8',
                  paddingLeft: 8,
                }}>{inner}</div>
              );
            }
            return <strong key={i} style={{ fontWeight: 800, color: '#0A1628' }}>{inner}</strong>;
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    );
  });
};

const Chatbot = () => {
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Xin chào! Tôi là trợ lý pháp lý AI. Bạn có thắc mắc gì về những điểm thay đổi trong tài liệu này không?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'ai', content: '' }]);
    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      if (!response.ok) throw new Error('Lỗi từ server');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev => {
          const msgs = [...prev];
          const last = { ...msgs[msgs.length - 1] };
          last.content += chunk;
          msgs[msgs.length - 1] = last;
          return msgs;
        });
      }
    } catch {
      setMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: 'Xin lỗi, đã có lỗi xảy ra hoặc dữ liệu so sánh chưa sẵn sàng.' };
        return msgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: '#fff',
      border: '1.5px solid #CBD5E1',
      display: 'flex',
      flexDirection: 'column',
      height: 600,
      overflow: 'hidden',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 1.25rem',
        background: '#0A1628',
        borderBottom: '4px solid #1B4FD8',
        flexShrink: 0, height: 52,
      }}>
        <span style={{
          background: '#1B4FD8', color: '#fff',
          fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.15em',
          padding: '0.18rem 0.55rem', textTransform: 'uppercase',
        }}>LAW</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', letterSpacing: '0.03em' }}>
          Trợ lý Pháp lý AI
        </span>
        <div style={{
          marginLeft: 'auto',
          fontSize: '0.68rem', fontWeight: 700, color: '#4ADE80',
          background: 'rgba(74,222,128,0.12)',
          border: '1px solid rgba(74,222,128,0.35)',
          padding: '0.18rem 0.6rem',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Dựa trên tài liệu hiện tại
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '1.5rem 0',
        display: 'flex', flexDirection: 'column', gap: 12,
        background: '#FAFAFA',
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '0 1.25rem',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            {/* Avatar */}
            {msg.role === 'ai' ? (
              <div style={{
                width: 28, height: 28, flexShrink: 0,
                background: '#1B4FD8', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '0.55rem', fontWeight: 900, color: '#fff',
                letterSpacing: '0.1em', marginTop: 2,
              }}>LAW</div>
            ) : (
              <div style={{
                width: 28, height: 28, flexShrink: 0,
                background: '#0A1628', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#fff', marginTop: 2,
              }}>
                <User size={14} />
              </div>
            )}

            {/* Bubble */}
            <div style={{
              fontSize: '0.9rem', lineHeight: 1.65,
              maxWidth: 'calc(100% - 80px)', wordBreak: 'break-word',
              ...(msg.role === 'user' ? {
                background: '#0A1628',
                color: '#fff',
                padding: '0.6rem 1rem',
                fontSize: '0.875rem',
              } : {
                color: '#0F172A',
                padding: '4px 0',
              })
            }}>
              {msg.content
                ? (msg.role === 'user' ? msg.content : renderMarkdown(msg.content))
                : (isLoading && idx === messages.length - 1
                  ? (
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center', height: 24, padding: '6px 0' }}>
                      {[0, 0.15, 0.3].map((delay, i) => (
                        <span key={i} style={{
                          width: 6, height: 6, background: '#94A3B8', display: 'inline-block',
                          animation: `cb-bounce 1.2s ease-in-out ${delay}s infinite`,
                        }} />
                      ))}
                    </span>
                  ) : null)
              }
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div style={{
        padding: '0.875rem 1.25rem 1rem',
        borderTop: '2px solid #CBD5E1',
        background: '#fff', flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          border: '1.5px solid #CBD5E1',
          padding: '0.6rem 0.6rem 0.6rem 1rem',
          background: '#F8FAFC',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi về điều khoản thay đổi, định nghĩa mới, quy định quan trọng…"
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'inherit', fontSize: '0.875rem', color: '#0F172A',
              resize: 'none', lineHeight: 1.6, maxHeight: 160, overflowY: 'auto',
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            style={{
              width: 34, height: 34, border: 'none', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              background: input.trim() && !isLoading ? '#1B4FD8' : '#E2E8F0',
              color: input.trim() && !isLoading ? '#fff' : '#94A3B8',
              transition: 'background 0.15s',
            }}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
        <p style={{
          margin: '6px 0 0', fontSize: '0.68rem',
          color: '#94A3B8', textAlign: 'center',
        }}>
          Trợ lý AI có thể mắc lỗi. Vui lòng kiểm tra thông tin quan trọng.
        </p>
      </div>

      <style>{`
        @keyframes cb-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        textarea::placeholder { color: #94A3B8; }
        div::-webkit-scrollbar { width: 3px; }
        div::-webkit-scrollbar-thumb { background: #CBD5E1; }
      `}</style>
    </div>
  );
};

export default Chatbot;