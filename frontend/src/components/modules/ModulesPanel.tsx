import { useState } from 'react';
import type { ModulesPayload, AlertData, LinksData, FaqData } from './types';
import DocumentChecklist from './DocumentChecklist';
import ProcessTimeline from './ProcessTimeline';
import ContactCard from './ContactCard';
import ModuleCard from './ModuleCard';
import './modules.css';

function AlertBlock({ data }: { data: AlertData }) {
  const icons = { info: 'ℹ️', warning: '⚠️', error: '❌' };
  return (
    <div className={`alert-block alert-block--${data.level}`}>
      <span className="alert-block__icon">{icons[data.level]}</span>
      <div>
        <strong className="alert-block__title">{data.title}</strong>
        <p className="alert-block__body">{data.body}</p>
      </div>
    </div>
  );
}

function LinksModule({ data }: { data: LinksData }) {
  return (
    <ModuleCard
      badge="Resources"
      badgeVariant="conditional"
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      }
      title="Useful links"
    >
      <div className="links-list">
        {data.items.map((item, i) => (
          <a key={i} href={item.url} target="_blank" rel="noreferrer" className="link-item">
            <span className="link-item__label">{item.label}</span>
            {item.description && <span className="link-item__desc">{item.description}</span>}
          </a>
        ))}
      </div>
    </ModuleCard>
  );
}

function FaqModule({ data }: { data: FaqData }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ModuleCard
      badge="FAQ"
      badgeVariant="conditional"
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      }
      title="Frequently asked"
    >
      <div className="faq-list">
        {data.items.map((item, i) => (
          <div key={i} className={`faq-item${open === i ? ' faq-item--open' : ''}`}>
            <button className="faq-item__q" onClick={() => setOpen(open === i ? null : i)}>
              {item.question}
              <svg className="faq-item__q-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {open === i && <p className="faq-item__a">{item.answer}</p>}
          </div>
        ))}
      </div>
    </ModuleCard>
  );
}

interface Props {
  payload: ModulesPayload;
}

export default function ModulesPanel({ payload }: Props) {
  const { modulesToRender, data } = payload;

  return (
    <aside className="modules-panel">
      {modulesToRender.map((key) => {
        switch (key) {
          case 'alert':
            return data.alert ? <AlertBlock key={key} data={data.alert} /> : null;
          case 'checklist':
            return data.checklist ? <DocumentChecklist key={key} data={data.checklist} /> : null;
          case 'process_timeline':
            return data.process_timeline ? <ProcessTimeline key={key} data={data.process_timeline} /> : null;
          case 'contact':
            return data.contact ? <ContactCard key={key} data={data.contact} /> : null;
          case 'links':
            return data.links ? <LinksModule key={key} data={data.links} /> : null;
          case 'faq':
            return data.faq ? <FaqModule key={key} data={data.faq} /> : null;
          default:
            return null;
        }
      })}
    </aside>
  );
}
