import ModuleCard from './ModuleCard';

const MOCK_STEPS = [
  { actor: 'You',  title: 'Gather required documents',        duration: '1–2 days',  variant: 'user' },
  { actor: 'You',  title: 'Submit application at MUP counter', duration: '~30 min',  variant: 'user' },
  { actor: 'City', title: 'Application review',               duration: '5–7 days',  variant: 'city' },
  { actor: 'City', title: 'ID card production',               duration: '3–5 days',  variant: 'city' },
  { actor: 'You',  title: 'Pick up your new ID card',         duration: '~10 min',   variant: 'done' },
];

function TimelineIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export default function ProcessTimeline() {
  return (
    <ModuleCard badge="Multi-step processes" badgeVariant="conditional" icon={<TimelineIcon />} title="Process timeline">
      <div className="timeline">
        {MOCK_STEPS.map((step, i) => (
          <div key={i} className="timeline-step">
            <div className={`timeline-step__dot timeline-step__dot--${step.variant}`}>
              {i + 1}
            </div>
            <div className="timeline-step__content">
              <p className="timeline-step__title">{step.title}</p>
              <div className="timeline-step__meta">
                <span className="timeline-step__actor">{step.actor}</span>
                <span>·</span>
                <span>{step.duration}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ModuleCard>
  );
}
