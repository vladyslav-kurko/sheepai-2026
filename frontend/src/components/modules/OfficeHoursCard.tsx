import ModuleCard from './ModuleCard';

const DAYS = [
  { day: 'Monday',    time: '08:00 – 16:00' },
  { day: 'Tuesday',   time: '08:00 – 16:00' },
  { day: 'Wednesday', time: '08:00 – 19:00' },
  { day: 'Thursday',  time: '08:00 – 16:00' },
  { day: 'Friday',    time: '08:00 – 14:00' },
  { day: 'Saturday',  time: 'Closed' },
  { day: 'Sunday',    time: 'Closed' },
];

const TODAY_INDEX = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

function isOpen() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  const todayRow = DAYS[TODAY_INDEX];
  if (todayRow.time === 'Closed') return false;
  const [start, end] = todayRow.time.split(' – ').map((t) => {
    const [hh, mm] = t.split(':').map(Number);
    return hh + mm / 60;
  });
  return h >= start && h < end;
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default function OfficeHoursCard() {
  const open = isOpen();

  return (
    <ModuleCard badge="Always shown" badgeVariant="always" icon={<ClockIcon />} title="Office hours">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span className={`hours-badge hours-badge--${open ? 'open' : 'closed'}`}>
          <span className="hours-dot" />
          {open ? 'Open now' : 'Closed'}
        </span>
      </div>
      <div className="hours-grid">
        {DAYS.map((row, i) => (
          <div key={row.day} className={`hours-row${i === TODAY_INDEX ? ' hours-row--today' : ''}`}>
            <span className="hours-row__day">{row.day}</span>
            <span className="hours-row__time">{row.time}</span>
          </div>
        ))}
      </div>
    </ModuleCard>
  );
}
