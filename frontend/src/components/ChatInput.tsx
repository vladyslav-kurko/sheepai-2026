import { useEffect } from 'react';
import type { RefObject } from 'react';
import { SendIcon } from './icons';

const MAX_HEIGHT = 160;

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  showHint: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

export default function ChatInput({ value, onChange, onSubmit, loading, showHint, inputRef }: Props) {
  // Auto-resize: shrink to 'auto' first so scrollHeight recalculates correctly
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + 'px';
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [value, inputRef]);

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    onSubmit();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="card__input-wrap">
      <form className="card__form" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="card__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Kako dobiti osobnu iskaznicu? / How to get an ID card?"
          rows={1}
          aria-label="Your question"
          disabled={loading}
        />
        <button
          type="submit"
          className="card__send"
          disabled={!value.trim() || loading}
          aria-label="Send"
        >
          <SendIcon />
        </button>
      </form>
      {showHint && <p className="card__hint">Enter to send · Shift+Enter for new line</p>}
    </div>
  );
}
