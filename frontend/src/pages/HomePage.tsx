import { useState, useRef, useEffect } from 'react';
import type { Message } from '../types';
import HeroSection from '../components/HeroSection';
import MessageList from '../components/MessageList';
import ChatInput from '../components/ChatInput';
import {
  prepareLanguageQuery,
  type ChatLanguage,
} from '../prompt-engineering';
import './HomePage.css';

// Replace with real API call when the backend is ready
async function sendToBackend(_message: string, language: ChatLanguage): Promise<string> {
  await new Promise((r) => setTimeout(r, 1500));
  return language === 'hr'
    ? 'Backend jos nije spojen.'
    : 'Backend is not connected yet.';
}

export default function HomePage() {
  const [chatStarted, setChatStarted] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mainLanguage, setMainLanguage] = useState<ChatLanguage | null>(null);
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
    const prepared = await prepareLanguageQuery(text, mainLanguage);
    const activeLanguage = prepared.language;
    const normalisedText = prepared.normalizedText;

    console.info('[PromptEngineering] language', {
      input: text,
      detectedLanguage: prepared.detectedLanguage,
      detectedIso3: prepared.iso3,
      source: prepared.source,
      confidence: prepared.confidence,
      isMixed: prepared.isMixed,
      activeLanguage,
    });
    console.info('[PromptEngineering] normalisation', {
      input: text,
      normalised: normalisedText,
      changed: prepared.changed,
    });

    if (!mainLanguage && prepared.confidence >= 0.65) {
      setMainLanguage(prepared.language);
    }

    if (!chatStarted) setChatStarted(true);

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const reply = await sendToBackend(trimmed);
      const reply = await sendToBackend(normalisedText, activeLanguage);
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
          <MessageList
            messages={messages}
            loading={loading}
            bottomRef={bottomRef}
            language={mainLanguage}
          />
        )}
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={submitMessage}
          onChipClick={submitText}
          loading={loading}
          showHint={!chatStarted}
          inputRef={inputRef}
          language={mainLanguage}
        />
      </div>
    </div>
  );
}
