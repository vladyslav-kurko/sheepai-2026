import { useState, useRef, useEffect, FormEvent } from 'react';
import type { Message } from '../types';
import './Chat.css';

const GREETING: Message = {
  id: 'greeting',
  role: 'assistant',
  content:
    'Bok! Pitajte me o bilo kojim dokumentima u Hrvatskoj.\nHello! Ask me about any documents in Croatia.',
};

function SheepIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="13" rx="7" ry="5.5" fill="#334155" />
      <ellipse cx="8.5" cy="10" rx="3" ry="3" fill="#334155" />
      <ellipse cx="15.5" cy="10" rx="3" ry="3" fill="#334155" />
      <ellipse cx="12" cy="9.5" rx="4.5" ry="3.5" fill="#334155" />
      <ellipse cx="12" cy="9" rx="3.5" ry="2.5" fill="#F8FAFC" />
      <circle cx="10.8" cy="8.8" r="0.6" fill="#020617" />
      <circle cx="13.2" cy="8.8" r="0.6" fill="#020617" />
      <rect x="10" y="16" width="1.5" height="3" rx="0.75" fill="#334155" />
      <rect x="12.5" y="16" width="1.5" height="3" rx="0.75" fill="#334155" />
    </svg>
  );
}

function ThinkingDots() {
  return (
    <div className="chat-bubble chat-bubble--assistant" aria-label="Assistant is thinking">
      <div className="thinking-dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

// Mocked send — replace with real API call when backend is ready
async function sendToBackend(userMessage: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 1400));
  return `(mock) You asked: "${userMessage}"\n\nBackend nije još spojen. / Backend not connected yet.`;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const reply = await sendToBackend(text);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  }

  return (
    <div className="chat-layout">
      <header className="chat-header">
        <div className="chat-header__brand">
          <SheepIcon />
          <span className="chat-header__name">SheepAI</span>
        </div>
        <p className="chat-header__tagline">Croatian document assistant</p>
      </header>

      <main className="chat-messages" aria-live="polite" aria-label="Chat messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-row chat-row--${msg.role}`}
          >
            <div className={`chat-bubble chat-bubble--${msg.role}`}>
              {msg.content.split('\n').map((line, i) => (
                <span key={i}>
                  {line}
                  {i < msg.content.split('\n').length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-row chat-row--assistant">
            <ThinkingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <footer className="chat-footer">
        <form className="chat-form" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Kako dobiti osobnu iskaznicu? / How to get an ID card?"
            rows={1}
            aria-label="Your message"
            disabled={loading}
          />
          <button
            type="submit"
            className="chat-send"
            disabled={!input.trim() || loading}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
        <p className="chat-hint">Enter to send · Shift+Enter for new line</p>
      </footer>
    </div>
  );
}
