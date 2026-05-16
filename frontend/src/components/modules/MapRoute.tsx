import { useState } from 'react';
import ModuleCard from './ModuleCard';

const ROUTES = [
  { mode: 'Walk',    icon: '🚶', time: '22 min' },
  { mode: 'Transit', icon: '🚌', time: '14 min' },
  { mode: 'Drive',   icon: '🚗', time: '8 min'  },
];

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function MapRoute() {
  const [active, setActive] = useState('Transit');

  return (
    <ModuleCard badge="When address known" badgeVariant="conditional" icon={<MapPinIcon />} title="Map + route">
      <p className="map-address">Ulica grada Vukovara 33, Zagreb</p>
      <div className="map-placeholder">Map preview</div>
      <div className="map-routes">
        {ROUTES.map((r) => (
          <button
            key={r.mode}
            className={`map-route-btn${active === r.mode ? ' map-route-btn--active' : ''}`}
            onClick={() => setActive(r.mode)}
          >
            <span>{r.icon}</span>
            <span className="map-route-btn__time">{r.time}</span>
            <span>{r.mode}</span>
          </button>
        ))}
      </div>
    </ModuleCard>
  );
}
