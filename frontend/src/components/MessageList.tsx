import type { RefObject } from 'react';
import type { Message } from '../types';

function ThinkingDots() {
  return (
    <div className="bubble bubble--assistant" aria-label="Assistant is thinking">
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
}

export default function MessageList({ messages, loading, bottomRef }: Props) {
  return (
    <main className="card__messages" aria-live="polite" aria-label="Chat messages">
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
          <ThinkingDots />
        </div>
      )}
      <div ref={bottomRef} />
    </main>
  );
}
