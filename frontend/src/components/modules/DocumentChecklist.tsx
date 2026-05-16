import { useState } from 'react';
import ModuleCard from './ModuleCard';

const MOCK_ITEMS = [
  { id: 1, name: 'Valid passport or old ID card', tip: 'Must not be expired' },
  { id: 2, name: 'Proof of residence (utility bill)', tip: 'Issued within the last 3 months' },
  { id: 3, name: 'Completed application form MUP-1', tip: 'Download from e-Građani portal' },
  { id: 4, name: 'Payment receipt (45 HRK fee)', tip: 'Pay at any FINA counter or via internet banking' },
];

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function DocumentChecklist() {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <ModuleCard badge="Always shown" badgeVariant="always" icon={<ChecklistIcon />} title="Document checklist">
      <div className="checklist">
        {MOCK_ITEMS.map((item) => {
          const done = checked.has(item.id);
          return (
            <div
              key={item.id}
              className={`checklist-item${done ? ' checklist-item--done' : ''}`}
              onClick={() => toggle(item.id)}
              role="checkbox"
              aria-checked={done}
              tabIndex={0}
              onKeyDown={(e) => e.key === ' ' && toggle(item.id)}
            >
              <div className="checklist-item__check">
                {done && <CheckMark />}
              </div>
              <div className="checklist-item__body">
                <div className="checklist-item__name">{item.name}</div>
                <div className="checklist-item__tip">{item.tip}</div>
              </div>
            </div>
          );
        })}
      </div>
    </ModuleCard>
  );
}
