// ─── Text ─────────────────────────────────────────────────────────────────────

export interface TextData {
  markdown: string;              // plain text or markdown content
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export type AlertLevel = 'info' | 'warning' | 'error' | 'success';

export interface AlertData {
  level: AlertLevel;             // required — controls colour/icon
  title: string;                 // required — short heading
  body?: string;                 // optional — longer explanation
}

// ─── Links ────────────────────────────────────────────────────────────────────

export interface LinkItem {
  label: string;                 // required — display text
  url: string;                   // required — destination
  description?: string;          // optional — tooltip or sub-label
}

export interface LinksData {
  items: LinkItem[];             // required
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

export interface FaqItem {
  question: string;              // required
  answer: string;                // required — plain text or markdown
}

export interface FaqData {
  items: FaqItem[];              // required
}

// ─── Download List ────────────────────────────────────────────────────────────

export interface DownloadItem {
  name: string;                  // required — document / form name
  url: string;                   // required — download link
  fileType?: string;             // optional — e.g. "PDF", "DOCX"
  description?: string;          // optional — brief note
}

export interface DownloadListData {
  items: DownloadItem[];         // required
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

export type QuickActionVariant = 'primary' | 'secondary';

export interface QuickAction {
  label: string;                 // required — button text
  url: string;                   // required — destination or deep-link
  variant?: QuickActionVariant;  // optional — styling hint
  icon?: string;                 // optional — icon name hint for frontend
}

export interface QuickActionsData {
  actions: QuickAction[];        // required — at least one
}

// ─── Status Tracker ───────────────────────────────────────────────────────────

export type StatusLevel = 'pending' | 'in_progress' | 'completed' | 'rejected';

export interface StatusStep {
  label: string;                 // required — step name
  status: StatusLevel;           // required — current state
  date?: string;                 // optional — ISO date string
  note?: string;                 // optional — extra info
}

export interface StatusTrackerData {
  steps: StatusStep[];           // required
  currentStep: number;           // required — 0-based index of the active step
}

// ─── Office Hours ─────────────────────────────────────────────────────────────

export interface OfficeHoursDay {
  day: string;                   // e.g. "Monday"
  time: string;                  // e.g. "08:00 – 16:00" | "Closed"
}

export interface OfficeHoursData {
  schedule: OfficeHoursDay[];    // required — full week schedule
  isOpenNow: boolean;            // required — current open/closed state
  holidayWarning?: string;       // optional — e.g. "Closed on 25.12."
}

// ─── Document Checklist ───────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  name: string;                  // required — document name
  tip?: string;                  // optional — hint or clarification
}

export interface DocumentChecklistData {
  items: ChecklistItem[];        // required
}

// ─── Process Timeline ─────────────────────────────────────────────────────────

export type TimelineActor = 'user' | 'city' | 'done';

export interface TimelineStep {
  title: string;                 // required — step description
  actor: TimelineActor;          // required — who performs this step
  duration: string;              // required — e.g. "1–2 days" | "~30 min"
}

export interface ProcessTimelineData {
  steps: TimelineStep[];         // required
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

export interface ContactCardData {
  department: string;            // required — e.g. "MUP — Osobne iskaznice"
  phone?: string;
  email?: string;
  address?: string;
  bookingUrl?: string;           // optional — direct online booking link
}

// ─── Fee Calculator ───────────────────────────────────────────────────────────

export type FeeItemType = 'fixed' | 'stepper' | 'checkbox';

interface FeeItemBase {
  id: string;
  type: FeeItemType;
  label: string;                 // required — displayed name
  unitPrice: number;             // required — price per unit in EUR
}

export interface FeeItemFixed    extends FeeItemBase { type: 'fixed' }
export interface FeeItemStepper  extends FeeItemBase { type: 'stepper'; min?: number; max?: number }
export interface FeeItemCheckbox extends FeeItemBase { type: 'checkbox' }

export type FeeItem = FeeItemFixed | FeeItemStepper | FeeItemCheckbox;

export interface FeeCalculatorData {
  items: FeeItem[];              // required — at least one item
  currency?: string;             // optional — defaults to "EUR"
}

// ─── Appointment Finder ───────────────────────────────────────────────────────

export interface AppointmentSlot {
  time: string;                  // required — e.g. "09:30"
  taken: boolean;                // required
}

export interface AppointmentFinderData {
  date: string;                  // required — ISO date string e.g. "2026-05-17"
  slots: AppointmentSlot[];      // required
  bookingUrl?: string;           // optional — URL to confirm via external system
}

// ─── Map + Route ──────────────────────────────────────────────────────────────

export interface RouteOption {
  mode: 'walk' | 'transit' | 'drive';
  duration: string;              // required — e.g. "14 min"
}

export interface MapRouteData {
  address: string;               // required — full street address
  lat?: number;
  lng?: number;
  routes?: RouteOption[];        // optional — if omitted, only address is shown
}

// ─── Form Prefill Engine ──────────────────────────────────────────────────────

export interface FormField {
  label: string;                 // required — field display name
  value?: string;                // optional — detected value
  prefilled: boolean;            // required
}

export interface FormPrefillData {
  fields: FormField[];           // required
  formUrl?: string;
  formName?: string;
}

// ─── Union for dynamic rendering ──────────────────────────────────────────────

export type ModuleKey =
  | 'text'
  | 'alert'
  | 'links'
  | 'faq'
  | 'download_list'
  | 'quick_actions'
  | 'status_tracker'
  | 'hours'
  | 'checklist'
  | 'process_timeline'
  | 'contact'
  | 'fee_calculator'
  | 'appointment_finder'
  | 'map'
  | 'form_prefill';

export interface ModulesPayload {
  modulesToRender: ModuleKey[];
  data: {
    text?:               TextData;
    alert?:              AlertData;
    links?:              LinksData;
    faq?:                FaqData;
    download_list?:      DownloadListData;
    quick_actions?:      QuickActionsData;
    status_tracker?:     StatusTrackerData;
    hours?:              OfficeHoursData;
    checklist?:          DocumentChecklistData;
    process_timeline?:   ProcessTimelineData;
    contact?:            ContactCardData;
    fee_calculator?:     FeeCalculatorData;
    appointment_finder?: AppointmentFinderData;
    map?:                MapRouteData;
    form_prefill?:       FormPrefillData;
  };
}
