import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const MOCK_HISTORY = [
  { id: '1', title: 'Osobna iskaznica — kako dobiti?', date: 'Danas' },
  { id: '2', title: 'OIB — registracija', date: 'Jučer' },
  { id: '3', title: 'Vozačka dozvola — obnova', date: '14. sij.' },
  { id: '4', title: 'Registracija obrta — koraci', date: '10. sij.' },
  { id: '5', title: 'Putovnica — potrebni dokumenti', date: '5. sij.' },
  { id: '6', title: 'Prijava u HZZ — nezaposlenost', date: '2. sij.' },
];

function ChatBubbleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <aside className="sidebar">
      <p className="sidebar__label">History</p>
      <div className="sidebar__list">
        {MOCK_HISTORY.map((item) => (
          <button key={item.id} className="sidebar__item" type="button">
            <span className="sidebar__item-icon"><ChatBubbleIcon /></span>
            <span className="sidebar__item-body">
              <span className="sidebar__item-title">{item.title}</span>
              <span className="sidebar__item-date">{item.date}</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
