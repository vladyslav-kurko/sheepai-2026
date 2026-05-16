import './modules.css';

interface Props {
  badge: string;
  badgeVariant: 'always' | 'conditional';
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

export default function ModuleCard({ badge, badgeVariant, icon, title, children }: Props) {
  return (
    <div className="module-card">
      <div className="module-card__header">
        <span className={`module-card__badge module-card__badge--${badgeVariant}`}>
          {badge}
        </span>
        <div className="module-card__title-row">
          <span className="module-card__icon">{icon}</span>
          <h3 className="module-card__title">{title}</h3>
        </div>
      </div>
      {children}
    </div>
  );
}
