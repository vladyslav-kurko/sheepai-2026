import OfficeHoursCard from '../components/modules/OfficeHoursCard';
import DocumentChecklist from '../components/modules/DocumentChecklist';
import ProcessTimeline from '../components/modules/ProcessTimeline';
import ContactCard from '../components/modules/ContactCard';
import FeeCalculator from '../components/modules/FeeCalculator';
import AppointmentFinder from '../components/modules/AppointmentFinder';
import MapRoute from '../components/modules/MapRoute';
import FormPrefillEngine from '../components/modules/FormPrefillEngine';
import type {
  DocumentChecklistData,
  ProcessTimelineData,
  ContactCardData,
} from '../components/modules/types';
import './ModulesPreviewPage.css';

const MOCK_CHECKLIST: DocumentChecklistData = {
  items: [
    { id: '1', name: 'Valid passport or old ID card', tip: 'Must not be expired' },
    { id: '2', name: 'Proof of residence (utility bill)', tip: 'Issued within the last 3 months' },
    { id: '3', name: 'Completed application form MUP-1', tip: 'Download from e-Građani portal' },
    { id: '4', name: 'Payment receipt (45 EUR fee)', tip: 'Pay at any FINA counter' },
  ],
};

const MOCK_TIMELINE: ProcessTimelineData = {
  steps: [
    { actor: 'user', title: 'Gather required documents', duration: '1–2 days' },
    { actor: 'user', title: 'Submit application at MUP counter', duration: '~30 min' },
    { actor: 'city', title: 'Application review', duration: '5–7 days' },
    { actor: 'city', title: 'ID card production', duration: '3–5 days' },
    { actor: 'done', title: 'Pick up your new ID card', duration: '~10 min' },
  ],
};

const MOCK_CONTACT: ContactCardData = {
  department: 'MUP — Osobne iskaznice',
  phone: '+385 1 4567 890',
  email: 'pisarnica@mup.hr',
  address: 'Ulica grada Vukovara 33, Zagreb',
};

export default function ModulesPreviewPage() {
  return (
    <div className="preview-page">
      <h2 className="preview-title">Output modules — preview</h2>
      <div className="preview-grid">
        <OfficeHoursCard />
        <DocumentChecklist data={MOCK_CHECKLIST} />
        <ProcessTimeline data={MOCK_TIMELINE} />
        <ContactCard data={MOCK_CONTACT} />
        <FeeCalculator />
        <AppointmentFinder />
        <MapRoute />
        <FormPrefillEngine />
      </div>
    </div>
  );
}
