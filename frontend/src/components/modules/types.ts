// ─── Office Hours ─────────────────────────────────────────────────────────────

export interface OfficeHoursDay {
  day: string;           // e.g. "Monday"
  time: string;          // e.g. "08:00 – 16:00" | "Closed"
}

export interface OfficeHoursData {
  schedule: OfficeHoursDay[];    // required — full week schedule
  isOpenNow: boolean;            // required — current open/closed state
  holidayWarning?: string;       // optional — e.g. "Closed on 25.12."
}

// ─── Document Checklist ───────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  name: string;          // required — document name
  tip?: string;          // optional — hint or clarification
}

export interface DocumentChecklistData {
  items: ChecklistItem[];    // required
}

// ─── Process Timeline ─────────────────────────────────────────────────────────

export type TimelineActor = 'user' | 'city' | 'done';

export interface TimelineStep {
  title: string;             // required — step description
  actor: TimelineActor;      // required — who performs this step
  duration: string;          // required — e.g. "1–2 days" | "~30 min"
}

export interface ProcessTimelineData {
  steps: TimelineStep[];     // required
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

export interface ContactCardData {
  department: string;        // required — e.g. "MUP — Osobne iskaznice"
  phone?: string;            // optional
  email?: string;            // optional
  address?: string;          // optional
  bookingUrl?: string;       // optional — direct online booking link
}

// ─── Fee Calculator ───────────────────────────────────────────────────────────

export type FeeItemType = 'fixed' | 'stepper' | 'checkbox';

interface FeeItemBase {
  id: string;
  type: FeeItemType;
  label: string;             // required — displayed name
  unitPrice: number;         // required — price per unit in HRK/EUR
}

export interface FeeItemFixed    extends FeeItemBase { type: 'fixed' }
export interface FeeItemStepper  extends FeeItemBase { type: 'stepper'; min?: number; max?: number }
export interface FeeItemCheckbox extends FeeItemBase { type: 'checkbox' }

export type FeeItem = FeeItemFixed | FeeItemStepper | FeeItemCheckbox;

export interface FeeCalculatorData {
  items: FeeItem[];          // required — at least one item
  currency?: string;         // optional — defaults to "EUR"
}

// ─── Appointment Finder ───────────────────────────────────────────────────────

export interface AppointmentSlot {
  time: string;              // required — e.g. "09:30"
  taken: boolean;            // required
}

export interface AppointmentFinderData {
  date: string;              // required — ISO date string e.g. "2026-05-17"
  slots: AppointmentSlot[];  // required
  bookingUrl?: string;       // optional — URL to confirm via external system
}

// ─── Map + Route ──────────────────────────────────────────────────────────────

export interface RouteOption {
  mode: 'walk' | 'transit' | 'drive';
  duration: string;          // required — e.g. "14 min"
}

export interface MapRouteData {
  address: string;           // required — full street address
  lat?: number;              // optional — for embedded map
  lng?: number;              // optional — for embedded map
  routes?: RouteOption[];    // optional — if omitted, only address is shown
}

// ─── Form Prefill Engine ──────────────────────────────────────────────────────

export interface FormField {
  label: string;             // required — field display name
  value?: string;            // optional — detected value (empty = not detected)
  prefilled: boolean;        // required — true if value was extracted from query
}

export interface FormPrefillData {
  fields: FormField[];       // required
  formUrl?: string;          // optional — link to the actual form
  formName?: string;         // optional — e.g. "MUP-1 Application Form"
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export interface AlertData {
  level: 'info' | 'warning' | 'error';
  title: string;
  body: string;
}

// ─── Links ────────────────────────────────────────────────────────────────────

export interface LinkItem {
  label: string;
  url: string;
  description?: string;
}

export interface LinksData {
  items: LinkItem[];
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqData {
  items: FaqItem[];
}

// ─── Union for dynamic rendering ──────────────────────────────────────────────
//
// The backend sends modulesToRender + a data map.
// The UI picks the right component for each key.

export type ModuleKey =
  | 'hours'
  | 'checklist'
  | 'process_timeline'
  | 'contact'
  | 'fee_calculator'
  | 'appointment_finder'
  | 'map'
  | 'form_prefill'
  | 'alert'
  | 'links'
  | 'faq';

export interface ModulesPayload {
  modulesToRender: ModuleKey[];
  data: {
    text?:               { markdown: string };
    hours?:              OfficeHoursData;
    checklist?:          DocumentChecklistData;
    process_timeline?:   ProcessTimelineData;
    contact?:            ContactCardData;
    fee_calculator?:     FeeCalculatorData;
    appointment_finder?: AppointmentFinderData;
    map?:                MapRouteData;
    form_prefill?:       FormPrefillData;
    alert?:              AlertData;
    links?:              LinksData;
    faq?:                FaqData;
  };
}
