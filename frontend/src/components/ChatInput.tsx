import { useEffect } from 'react';
import type { RefObject } from 'react';
import { SendIcon } from './icons';
import type { ChatLanguage } from '../prompt-engineering';

const MAX_HEIGHT = 160;

const CHIPS = [
  'Kako dobiti osobnu iskaznicu?',
  'Što je OIB i kako ga dobiti?',
  'Registracija obrta — koraci',
  'Nova putovnica — dokumenti',
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onChipClick?: (text: string) => void;
  loading: boolean;
  showHint: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  language: ChatLanguage | null;
}

export default function ChatInput({ value, onChange, onSubmit, onChipClick, loading, showHint, inputRef }: Props) {
const COPY = {
  hr: {
    placeholder: 'Kako dobiti osobnu iskaznicu?',
    inputLabel: 'Vase pitanje',
    sendLabel: 'Posalji',
    hint: 'Enter za slanje · Shift+Enter za novi red',
  },
  en: {
    placeholder: 'How do I get an ID card?',
    inputLabel: 'Your question',
    sendLabel: 'Send',
    hint: 'Enter to send · Shift+Enter for new line',
  },
  default: {
    placeholder: 'Kako dobiti osobnu iskaznicu? / How do I get an ID card?',
    inputLabel: 'Your question / Vase pitanje',
    sendLabel: 'Send / Posalji',
    hint: 'Enter to send · Shift+Enter for new line',
  },
} as const;

export default function ChatInput({ value, onChange, onSubmit, loading, showHint, inputRef, language }: Props) {
  const copy = language ? COPY[language] : COPY.default;

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
          placeholder="Pitajte bilo što o dokumentima…"
          placeholder={copy.placeholder}
          rows={1}
          aria-label={copy.inputLabel}
          disabled={loading}
        />
        <button
          type="submit"
          className="card__send"
          disabled={!value.trim() || loading}
          aria-label={copy.sendLabel}
        >
          <SendIcon />
        </button>
      </form>
      {/* {showHint && <p className="card__hint">Enter za slanje · Shift+Enter novi red</p>} */}
      {showHint && onChipClick && (
        <div className="card__chips">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="card__chip"
              onClick={() => onChipClick(chip)}
              disabled={loading}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
      {showHint && <p className="card__hint">{copy.hint}</p>}
    </div>
  );
}
