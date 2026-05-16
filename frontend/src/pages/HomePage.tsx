import { useState, useRef, useEffect } from 'react';
import type { Message } from '../types';
import HeroSection from '../components/HeroSection';
import MessageList from '../components/MessageList';
import ChatInput from '../components/ChatInput';
import './HomePage.css';

async function sendToBackend(_message: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 1500));
  return 'Backend nije još spojen.\nBackend not connected yet.';
}

export default function HomePage() {
  const [chatStarted, setChatStarted] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function submitText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (!chatStarted) {
      setHeroVisible(false);
      await new Promise((r) => setTimeout(r, 200));
      setChatStarted(true);
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const reply = await sendToBackend(trimmed);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function submitMessage() {
    submitText(input);
  }

  return (
    <div className="page">
      <div className={`card${chatStarted ? ' card--chat' : ''}`}>
        {!chatStarted && <HeroSection visible={heroVisible} />}
        {chatStarted && (
          <MessageList messages={messages} loading={loading} bottomRef={bottomRef} />
        )}
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={submitMessage}
          onChipClick={submitText}
          loading={loading}
          showHint={!chatStarted}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}
