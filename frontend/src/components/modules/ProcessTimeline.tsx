import ModuleCard from './ModuleCard';
import type { ProcessTimelineData } from './types';

function TimelineIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

const ACTOR_LABEL: Record<string, string> = {
  user: 'You',
  city: 'Authority',
  done: 'Done',
};

interface Props {
  data: ProcessTimelineData;
}

export default function ProcessTimeline({ data }: Props) {
  return (
    <ModuleCard badge="Process" badgeVariant="conditional" icon={<TimelineIcon />} title="Step-by-step process">
      <div className="timeline">
        {data.steps.map((step, i) => (
          <div key={i} className="timeline-step">
            <div className={`timeline-step__dot timeline-step__dot--${step.actor}`}>
              {i + 1}
            </div>
            <div className="timeline-step__content">
              <p className="timeline-step__title">{step.title}</p>
              <div className="timeline-step__meta">
                <span className="timeline-step__actor">{ACTOR_LABEL[step.actor] ?? step.actor}</span>
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
