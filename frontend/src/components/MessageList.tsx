import type { RefObject } from 'react';
import type { Message } from '../types';
import type { ChatLanguage } from '../prompt-engineering';

function ThinkingDots({ language }: { language: ChatLanguage | null }) {
  const label = language === 'en' ? 'Assistant is thinking' : 'Asistent razmislja';

  return (
    <div className="bubble bubble--assistant" aria-label={label}>
      <div className="thinking-dots">
        <span /><span /><span />
      </div>
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
            {msg.content.split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </div>
        </div>
      ))}
      {loading && (
        <div className="msg-row msg-row--assistant">
          <ThinkingDots language={language} />
        </div>
      )}
      <div ref={bottomRef} />
    </main>
  );
}
