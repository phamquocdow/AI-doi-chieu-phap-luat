import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';

const Chatbot = () => {
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Xin chào! Tôi là trợ lý pháp lý AI. Bạn có thắc mắc gì về những điểm thay đổi trong tài liệu này không?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    <div className="lc-chat">
      {/* Header */}
      <div className="lc-chat-header">
        <div className="lc-chat-avatar-lg">
          <Bot size={20} color="#fff" />
        </div>
        <div>
          <h3 className="lc-chat-name">Trợ lý AI Pháp lý</h3>
          <span className="lc-chat-status">● Đang hoạt động · Dựa trên Báo cáo hiện tại</span>
        </div>
      </div>

      {/* Messages */}
      <div className="lc-chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`lc-msg-row ${msg.role === 'user' ? 'lc-msg-row-user' : ''}`}>
            <div className={`lc-msg-avatar ${msg.role === 'user' ? 'lc-msg-avatar-user' : 'lc-msg-avatar-ai'}`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`lc-msg-bubble ${msg.role === 'user' ? 'lc-msg-bubble-user' : 'lc-msg-bubble-ai'}`}>
              {msg.content || (isLoading && idx === messages.length - 1 ? <Loader2 size={16} className="lc-spin-sm" /> : null)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="lc-chat-input-area">
        <div className="lc-chat-input-wrap">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi về điều khoản thay đổi, định nghĩa mới, quy định quan trọng..."
            className="lc-chat-input"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className={`lc-chat-send ${input.trim() && !isLoading ? 'lc-chat-send-active' : ''}`}
          >
            <Send size={17} />
          </button>
        </div>
      </div>

      <style>{`
        .lc-chat {
          background: #fff;
          border: 1px solid #dbeafe;
          border-radius: 1.25rem;
          display: flex; flex-direction: column;
          height: 580px; overflow: hidden;
          box-shadow: 0 4px 24px rgba(30,64,175,.07);
        }
        .lc-chat-header {
          display: flex; align-items: center; gap: 0.875rem;
          padding: 1.1rem 1.5rem;
          background: linear-gradient(135deg, #1d4ed8, #0369a1);
          flex-shrink: 0;
        }
        .lc-chat-avatar-lg {
          width: 40px; height: 40px; border-radius: 50%;
          background: rgba(255,255,255,.2);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lc-chat-name { color: #fff; font-size: 1rem; font-weight: 700; margin: 0; }
        .lc-chat-status { color: rgba(255,255,255,.75); font-size: 0.78rem; }
        .lc-chat-messages {
          flex: 1; overflow-y: auto; padding: 1.5rem;
          display: flex; flex-direction: column; gap: 1rem;
          background: #f8fbff;
        }
        .lc-msg-row { display: flex; gap: 0.6rem; align-items: flex-end; }
        .lc-msg-row-user { flex-direction: row-reverse; }
        .lc-msg-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lc-msg-avatar-ai { background: linear-gradient(135deg,#1d4ed8,#0369a1); color: #fff; }
        .lc-msg-avatar-user { background: #dbeafe; color: #1d4ed8; }
        .lc-msg-bubble {
          max-width: 78%; padding: 0.85rem 1.1rem;
          border-radius: 1.1rem; font-size: 0.92rem; line-height: 1.65;
          white-space: pre-wrap;
        }
        .lc-msg-bubble-ai {
          background: #fff; color: #1e3a6e;
          border: 1px solid #dbeafe;
          border-bottom-left-radius: 0.25rem;
        }
        .lc-msg-bubble-user {
          background: linear-gradient(135deg,#1d4ed8,#0369a1);
          color: #fff; border-bottom-right-radius: 0.25rem;
        }
        .lc-chat-input-area {
          padding: 1rem 1.25rem; border-top: 1px solid #dbeafe;
          background: #fff; flex-shrink: 0;
        }
        .lc-chat-input-wrap {
          display: flex; align-items: center; gap: 0.5rem;
          background: #f0f6ff; border: 1.5px solid #bfdbfe;
          border-radius: 9999px; padding: 0.3rem 0.3rem 0.3rem 1.1rem;
          transition: border-color 0.15s;
        }
        .lc-chat-input-wrap:focus-within { border-color: #1d4ed8; background: #fff; }
        .lc-chat-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 0.9rem; color: #0f2545;
        }
        .lc-chat-input::placeholder { color: #94a3b8; }
        .lc-chat-send {
          width: 40px; height: 40px; border-radius: 50%;
          border: none; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s; flex-shrink: 0;
          background: #e2e8f0; color: #94a3b8;
        }
        .lc-chat-send-active { background: linear-gradient(135deg,#1d4ed8,#0369a1); color: #fff; }
        .lc-chat-send-active:hover { transform: scale(1.06); }
        @keyframes lc-spin { 100% { transform: rotate(360deg); } }
        .lc-spin-sm { animation: lc-spin 1s linear infinite; display: block; }
      `}</style>
    </div>
  );
};

export default Chatbot;
