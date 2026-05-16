import { useState } from 'react';
import ModuleCard from './ModuleCard';

// Each item is one of three types:
//   fixed    — always included, no interaction
//   stepper  — quantity the user can adjust
//   checkbox — optional add-on the user can toggle

type FeeItem =
  | { type: 'fixed';   id: string; label: string; unitPrice: number }
  | { type: 'stepper'; id: string; label: string; unitPrice: number; min?: number; max?: number }
  | { type: 'checkbox'; id: string; label: string; unitPrice: number };

const MOCK_ITEMS: FeeItem[] = [
  { type: 'fixed',    id: 'base',      label: 'Application fee',       unitPrice: 45 },
  { type: 'stepper',  id: 'copies',    label: 'Additional copies',     unitPrice: 20, min: 0, max: 10 },
  { type: 'checkbox', id: 'urgent',    label: 'Urgent processing',     unitPrice: 25 },
  { type: 'checkbox', id: 'apostille', label: 'Apostille stamp',       unitPrice: 60 },
];

function CalcIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="10" y2="10" />
      <line x1="14" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="10" y2="14" />
      <line x1="14" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="10" y2="18" />
      <line x1="14" y1="18" x2="16" y2="18" />
    </svg>
  );
}

export default function FeeCalculator() {
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(MOCK_ITEMS.map((item) => [item.id, item.type === 'fixed' ? 1 : 0]))
  );

  function setQty(id: string, value: number) {
    setQuantities((prev) => ({ ...prev, [id]: value }));
  }

  function toggleCheckbox(id: string) {
    setQuantities((prev) => ({ ...prev, [id]: prev[id] ? 0 : 1 }));
  }

  const lineItems = MOCK_ITEMS.filter((item) => quantities[item.id] > 0);
  const total = MOCK_ITEMS.reduce((sum, item) => sum + item.unitPrice * quantities[item.id], 0);

  return (
    <ModuleCard badge="When fees apply" badgeVariant="conditional" icon={<CalcIcon />} title="Fee calculator">
      <div className="fee-calc">
        {MOCK_ITEMS.map((item) => {
          const qty = quantities[item.id];

          if (item.type === 'fixed') {
            return (
              <div key={item.id} className="fee-calc__row">
                <span className="fee-calc__label">{item.label}</span>
                <span className="fee-calc__value">{item.unitPrice} HRK</span>
              </div>
            );
          }

          if (item.type === 'stepper') {
            const min = item.min ?? 0;
            const max = item.max ?? 99;
            return (
              <div key={item.id} className="fee-calc__input-row">
                <span className="fee-calc__label">{item.label}</span>
                <div className="fee-calc__stepper">
                  <button className="fee-calc__btn" onClick={() => setQty(item.id, Math.max(min, qty - 1))}>−</button>
                  <span className="fee-calc__count">{qty}</span>
                  <button className="fee-calc__btn" onClick={() => setQty(item.id, Math.min(max, qty + 1))}>+</button>
                </div>
              </div>
            );
          }

          if (item.type === 'checkbox') {
            return (
              <div key={item.id} className="fee-calc__input-row">
                <span className="fee-calc__label">{item.label} <span style={{ color: '#94A3B8' }}>+{item.unitPrice} HRK</span></span>
                <input
                  type="checkbox"
                  checked={qty > 0}
                  onChange={() => toggleCheckbox(item.id)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#0369A1' }}
                />
              </div>
            );
          }
        })}

        {lineItems.length > 0 && (
          <div className="fee-calc__breakdown">
            {lineItems.map((item) => (
              <div key={item.id} className="fee-calc__row fee-calc__row--sub">
                <span className="fee-calc__label">
                  {item.label}{quantities[item.id] > 1 ? ` × ${quantities[item.id]}` : ''}
                </span>
                <span className="fee-calc__value">{item.unitPrice * quantities[item.id]} HRK</span>
              </div>
            ))}
          </div>
        )}

        <div className="fee-calc__row fee-calc__row--total">
          <span>Total</span>
          <span>{total} HRK</span>
        </div>
      </div>
    </ModuleCard>
  );
}
