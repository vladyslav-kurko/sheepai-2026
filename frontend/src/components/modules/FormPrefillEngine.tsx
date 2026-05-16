import ModuleCard from './ModuleCard';

const MOCK_FIELDS = [
  { label: 'Full name',        value: 'Ivan Horvat',           prefilled: true  },
  { label: 'OIB',              value: '12345678901',           prefilled: true  },
  { label: 'Date of birth',    value: '15.03.1988',            prefilled: true  },
  { label: 'Purpose',          value: '',                      prefilled: false },
  { label: 'Number of copies', value: '',                      prefilled: false },
];

function FormIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

export default function FormPrefillEngine() {
  const prefilled = MOCK_FIELDS.filter((f) => f.prefilled).length;

  return (
    <ModuleCard badge="When forms exist" badgeVariant="conditional" icon={<FormIcon />} title="Form prefill engine">
      <p style={{ fontSize: 12.5, color: '#64748B', margin: 0 }}>
        {prefilled} of {MOCK_FIELDS.length} fields pre-filled from your query
      </p>
      <div className="form-fields">
        {MOCK_FIELDS.map((field) => (
          <div key={field.label} className="form-field">
            <label className="form-field__label">{field.label}</label>
            <div className={`form-field__value${field.prefilled ? ' form-field__value--prefilled' : ''}`}>
              {field.value || <span style={{ color: '#CBD5E1' }}>Not detected</span>}
            </div>
          </div>
        ))}
      </div>
      <button className="form-open-btn">Open pre-filled form</button>
    </ModuleCard>
  );
}
