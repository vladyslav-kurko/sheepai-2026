import { useState, useEffect, useRef, type RefObject } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../types';
import type { ChatLanguage } from '../prompt-engineering';

const PHRASES_HR = [
  'Razmišljam',
  'Tražim informacije',
  'Provjeravam podatke',
  'Slagam odgovor',
  'Analiziram upit',
  'Pronalazim rješenje',
];

const PHRASES_EN = [
  'Thinking',
  'Looking things up',
  'Checking the details',
  'Putting it together',
  'Analyzing your request',
  'Finding the answer',
];

function ThinkingText({ language }: { language: ChatLanguage | null }) {
  const phrases = language === 'en' ? PHRASES_EN : PHRASES_HR;
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState<'typing' | 'holding' | 'deleting'>('typing');
  const indexRef = useRef(0);

  useEffect(() => {
    const phrase = phrases[indexRef.current];

    if (phase === 'typing') {
      if (displayed.length < phrase.length) {
        const t = setTimeout(
          () => setDisplayed(phrase.slice(0, displayed.length + 1)),
          55,
        );
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase('deleting'), 1400);
      return () => clearTimeout(t);
    }

    if (phase === 'deleting') {
      if (displayed.length > 0) {
        const t = setTimeout(() => setDisplayed((d) => d.slice(0, -1)), 32);
        return () => clearTimeout(t);
      }
      indexRef.current = (indexRef.current + 1) % phrases.length;
      setIndex(indexRef.current);
      setPhase('typing');
    }
  }, [displayed, phase, index, phrases]);

  return (
    <div className="bubble bubble--assistant thinking-bubble">
      <span className="thinking-bubble__text">{displayed}</span>
      <span className="thinking-bubble__cursor" aria-hidden="true" />
    </div>
  );
}

interface Props {
  messages: Message[];
  loading: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
  language: ChatLanguage | null;
}

export default function MessageList({ messages, loading, bottomRef, language }: Props) {
  const ariaLabel = language === 'en' ? 'Chat messages' : 'Poruke razgovora';

  return (
    <main className="card__messages" aria-live="polite" aria-label={ariaLabel}>
      <div className="card__messages-spacer" />
      {messages.map((msg) => (
        <div key={msg.id} className={`msg-row msg-row--${msg.role}`}>
          <div className={`bubble bubble--${msg.role}`}>
            {msg.role === 'assistant' ? (
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            ) : (
              msg.content.split('\n').map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
              ))
            )}
          </div>
        </div>
      ))}
      {loading && (
        <div className="msg-row msg-row--assistant">
          <ThinkingText language={language} />
        </div>
      )}
      <div ref={bottomRef} />
    </main>
  );
}
