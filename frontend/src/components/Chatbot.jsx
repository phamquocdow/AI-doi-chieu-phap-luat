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
          fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
          margin: '12px 0 6px', borderBottom: '1px solid var(--accent-blue)',
          paddingBottom: '4px', display: 'inline-block',
        }}>{content}</div>
      );
    }
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const isStandaloneBold = parts.length === 3 && parts[0].trim() === '' && parts[2].trim() === '';
    return (
      <div key={index} style={{ marginBottom: '5px', lineHeight: 1.6 }}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const inner = part.slice(2, -2);
            if (isStandaloneBold) {
              return (
                <div key={i} style={{
                  fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  margin: '10px 0 6px', borderLeft: '3px solid var(--accent-blue)',
                  paddingLeft: '8px',
                }}>{inner}</div>
              );
            }
            return <strong key={i} style={{ fontWeight: 700, color: 'var(--text-main)' }}>{inner}</strong>;
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
      fontFamily: 'inherit',
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-hairline)',
      display: 'flex',
      flexDirection: 'column',
      height: 600,
      overflow: 'hidden',
      borderRadius: 'var(--radius-md)',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '0 1.25rem',
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-hairline)',
        flexShrink: 0, height: 52,
      }}>
        <span style={{
          background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)',
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
          padding: '0.2rem 0.5rem', textTransform: 'uppercase',
          borderRadius: 'var(--radius-sm)',
        }}>LAW</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '0.02em' }}>
          Trợ lý Pháp lý AI
        </span>
        <div style={{
          marginLeft: 'auto',
          fontSize: '0.65rem', fontWeight: 700, color: 'var(--ok-text)',
          background: 'var(--ok-bg)',
          border: '1px solid var(--ok-text)',
          padding: '0.2rem 0.5rem',
          textTransform: 'uppercase', letterSpacing: '0.05em',
          borderRadius: 'var(--radius-sm)',
        }}>
          Dựa trên tài liệu hiện tại
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '1.5rem 0',
        display: 'flex', flexDirection: 'column', gap: '12px',
        background: 'var(--bg-panel)',
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            padding: '0 1.25rem',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            {/* Avatar */}
            {msg.role === 'ai' ? (
              <div style={{
                width: 28, height: 28, flexShrink: 0,
                background: 'var(--accent-blue)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 700, color: '#fff',
                letterSpacing: '0.05em', marginTop: '2px',
                borderRadius: 'var(--radius-sm)',
              }}>LAW</div>
            ) : (
              <div style={{
                width: 28, height: 28, flexShrink: 0,
                background: 'var(--bg-sidebar)', border: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-main)', marginTop: '2px',
                borderRadius: 'var(--radius-sm)',
              }}>
                <User size={14} />
              </div>
            )}

            {/* Bubble */}
            <div style={{
              fontSize: '0.85rem', lineHeight: 1.6,
              maxWidth: 'calc(100% - 80px)', wordBreak: 'break-word',
              ...(msg.role === 'user' ? {
                background: 'var(--bg-sidebar)',
                border: '1px solid var(--border-hairline)',
                color: 'var(--text-main)',
                padding: '0.625rem 1rem',
                borderRadius: 'var(--radius-sm)',
              } : {
                color: 'var(--text-main)',
                padding: '4px 0',
              })
            }}>
              {msg.content
                ? (msg.role === 'user' ? msg.content : renderMarkdown(msg.content))
                : (isLoading && idx === messages.length - 1
                  ? (
                    <span style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '24px', padding: '6px 0' }}>
                      {[0, 0.15, 0.3].map((delay, i) => (
                        <span key={i} style={{
                          width: 6, height: 6, background: 'var(--text-muted)', display: 'inline-block',
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
        borderTop: '1px solid var(--border-hairline)',
        background: 'var(--bg-panel)', flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: '8px',
          border: '1px solid var(--border-hairline)',
          padding: '0.625rem 0.625rem 0.625rem 1rem',
          background: 'var(--bg-main)',
          borderRadius: 'var(--radius-sm)',
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
              fontFamily: 'inherit', fontSize: '0.85rem', color: 'var(--text-main)',
              resize: 'none', lineHeight: 1.6, maxHeight: 160, overflowY: 'auto',
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            style={{
              width: 32, height: 32, border: 'none', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              background: input.trim() && !isLoading ? 'var(--accent-blue)' : 'var(--bg-panel)',
              border: input.trim() && !isLoading ? 'none' : '1px solid var(--border-hairline)',
              color: input.trim() && !isLoading ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={e => { if (input.trim() && !isLoading) e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
            onMouseLeave={e => { if (input.trim() && !isLoading) e.currentTarget.style.background = 'var(--accent-blue)'; }}
          >
            <ArrowUp size={16} strokeWidth={2} />
          </button>
        </div>
        <p style={{
          margin: '6px 0 0', fontSize: '0.7rem',
          color: 'var(--text-muted)', textAlign: 'center',
        }}>
          Trợ lý AI có thể mắc lỗi. Vui lòng kiểm tra thông tin quan trọng.
        </p>
      </div>

      <style>{`
        @keyframes cb-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        textarea::placeholder { color: var(--text-muted); }
        div::-webkit-scrollbar { width: 4px; }
        div::-webkit-scrollbar-thumb { background: var(--border-hairline); border-radius: var(--radius-sm); }
        div::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
      `}</style>
    </div>
  );
};

export default Chatbot;