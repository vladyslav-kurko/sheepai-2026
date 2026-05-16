import ModuleCard from './ModuleCard';
import type { ContactCardData } from './types';

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function RowIcon({ d }: { d: string }) {
  return (
    <svg className="contact-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d={d} />
    </svg>
  );
}

interface Props {
  data: ContactCardData;
}

export default function ContactCard({ data }: Props) {
  const rows = [
    data.phone && {
      icon: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z',
      label: 'Phone', value: data.phone, href: `tel:${data.phone.replace(/\s/g, '')}`,
    },
    data.email && {
      icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6',
      label: 'Email', value: data.email, href: `mailto:${data.email}`,
    },
    data.address && {
      icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
      label: 'Address', value: data.address, href: undefined,
    },
    {
      icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
      label: 'Dept.', value: data.department, href: undefined,
    },
  ].filter(Boolean) as { icon: string; label: string; value: string; href: string | undefined }[];

  return (
    <ModuleCard badge="Contact" badgeVariant="always" icon={<PhoneIcon />} title="Contact">
      <div className="contact-list">
        {rows.map((row) =>
          row.href ? (
            <a key={row.label} className="contact-row" href={row.href} target="_blank" rel="noreferrer">
              <RowIcon d={row.icon} />
              <span className="contact-row__label">{row.label}</span>
              <span className="contact-row__value">{row.value}</span>
            </a>
          ) : (
            <div key={row.label} className="contact-row">
              <RowIcon d={row.icon} />
              <span className="contact-row__label">{row.label}</span>
              <span className="contact-row__value">{row.value}</span>
            </div>
          )
        )}
      </div>
      {data.bookingUrl && (
        <a className="contact-book-btn" href={data.bookingUrl} target="_blank" rel="noreferrer">
          Book appointment online
        </a>
      )}
    </ModuleCard>
  );
}
