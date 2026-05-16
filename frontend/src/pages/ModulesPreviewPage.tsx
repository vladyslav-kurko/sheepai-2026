import OfficeHoursCard from '../components/modules/OfficeHoursCard';
import DocumentChecklist from '../components/modules/DocumentChecklist';
import ProcessTimeline from '../components/modules/ProcessTimeline';
import ContactCard from '../components/modules/ContactCard';
import FeeCalculator from '../components/modules/FeeCalculator';
import AppointmentFinder from '../components/modules/AppointmentFinder';
import MapRoute from '../components/modules/MapRoute';
import FormPrefillEngine from '../components/modules/FormPrefillEngine';
import './ModulesPreviewPage.css';

export default function ModulesPreviewPage() {
  return (
    <div className="preview-page">
      <h2 className="preview-title">Output modules — preview</h2>
      <div className="preview-grid">
        <OfficeHoursCard />
        <DocumentChecklist />
        <ProcessTimeline />
        <ContactCard />
        <FeeCalculator />
        <AppointmentFinder />
        <MapRoute />
        <FormPrefillEngine />
      </div>
    </div>
  );
}
