import { useState } from 'react';
import ModuleCard from './ModuleCard';

const SLOTS = [
  { time: '08:30', taken: false },
  { time: '09:00', taken: true  },
  { time: '09:30', taken: false },
  { time: '10:00', taken: false },
  { time: '10:30', taken: true  },
  { time: '11:00', taken: false },
  { time: '11:30', taken: false },
  { time: '14:00', taken: false },
];

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export default function AppointmentFinder() {
  const [selected, setSelected] = useState<string | null>(null);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateLabel = tomorrow.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ModuleCard badge="When bookable" badgeVariant="conditional" icon={<CalendarIcon />} title="Appointment finder">
      <p className="appt-date-label">{dateLabel}</p>
      <div className="appt-slots">
        {SLOTS.map((slot) => (
          <button
            key={slot.time}
            className={[
              'appt-slot',
              slot.taken ? 'appt-slot--taken' : '',
              selected === slot.time ? 'appt-slot--selected' : '',
            ].join(' ')}
            disabled={slot.taken}
            onClick={() => setSelected(slot.time)}
          >
            {slot.time}
          </button>
        ))}
      </div>
      <button className="appt-confirm-btn" disabled={!selected}>
        {selected ? `Confirm ${selected}` : 'Select a time slot'}
      </button>
    </ModuleCard>
  );
}
