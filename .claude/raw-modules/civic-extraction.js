/**
 * civic-extraction.js
 *
 * Structured extraction prompt module.
 * Turns a raw scraped government page into a validated PageData object
 * that all output modules (hours, checklist, fees, forms, map) consume.
 *
 * Three-strategy cascade:
 *   1. Regex fast-path  — zero API cost, handles well-structured pages
 *   2. Claude text      — main extraction, structured JSON prompt
 *   3. Claude vision    — fallback for JS-rendered or image-heavy pages
 *
 * Followed by schema validation + one automatic repair pass on bad JSON.
 */

// ─── OUTPUT SCHEMA ────────────────────────────────────────────────────────────
//
// Every field is nullable. Modules check for null and degrade gracefully.
// This is the single source of truth shared with all output modules.

export const PAGE_DATA_SCHEMA = {
  // Office identity
  office_name:    'string | null',   // "Gradski ured za prostorno uređenje"
  department:     'string | null',   // sub-department if applicable
  city:           'string | null',   // "Zagreb"
  source_url:     'string | null',   // canonical URL of the page

  // Working hours  →  hours card module
  hours: {
    monday:     'string | null',     // "08:00–16:00"
    tuesday:    'string | null',
    wednesday:  'string | null',
    thursday:   'string | null',
    friday:     'string | null',
    saturday:   'string | null',     // null = closed
    sunday:     'string | null',
    note:       'string | null',     // "Closed on public holidays"
    raw:        'string | null',     // unparsed hours text as fallback
  },

  // Contact  →  contact card module
  contact: {
    phone:        'string[]',        // may have multiple lines
    email:        'string[]',
    fax:          'string | null',
    address:      'string | null',   // full postal address
    postal_code:  'string | null',
    maps_query:   'string | null',   // address formatted for Google Maps
  },

  // Required documents  →  checklist module
  required_documents: [
    // { name: string, note: string|null, mandatory: boolean }
  ],

  // Fees  →  fee calculator module
  fees: [
    // { label: string, amount: number|null, currency: string, note: string|null }
  ],

  // Process steps  →  timeline module
  process_steps: [
    // { step: number, title: string, description: string|null, duration: string|null }
  ],

  // Forms / downloads  →  form prefill module
  forms: [
    // { title: string, url: string, type: 'pdf'|'docx'|'html'|'other', fillable: boolean|null }
  ],

  // Appointment booking  →  appointment finder module
  appointment: {
    bookable_online:  'boolean',
    booking_url:      'string | null',
    booking_phone:    'string | null',
    notes:            'string | null',
  },

  // Extraction metadata
  _meta: {
    strategy:         'string',      // 'regex' | 'claude-text' | 'claude-vision'
    confidence:       'number',      // 0–1
    extraction_ts:    'string',      // ISO timestamp
    warnings:         'string[]',    // non-fatal issues found during extraction
  },
};


// ─── 1. HTML PRE-PROCESSOR ───────────────────────────────────────────────────
//
// Strips boilerplate (nav, footer, cookie banners, scripts, ads) and returns
// clean text chunks small enough to fit in a Claude prompt.
// Also does a first-pass regex extraction before touching the API.

const NOISE_SELECTORS = [
  'nav', 'header', 'footer', 'aside',
  '.cookie-banner', '.cookie-notice', '#cookie',
  '.breadcrumb', '.breadcrumbs',
  '.social-links', '.social-share',
  '.advertisement', '.ads', '#ads',
  'script', 'style', 'noscript', 'iframe',
  '.search-box', '#search',
  '.site-map', '.sitemap',
  '.pagination',
].join(', ');

export function preprocessHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove noise elements
  doc.querySelectorAll(NOISE_SELECTORS).forEach(el => el.remove());

  // Extract full plain text
  const fullText = doc.body?.innerText ?? doc.body?.textContent ?? '';

  // Identify the main content zone (largest text block)
  const candidates = ['main', 'article', '#content', '.content',
                       '#main-content', '.main-content', '.page-content'];
  let mainEl = null;
  for (const sel of candidates) {
    const el = doc.querySelector(sel);
    if (el && el.textContent.length > 200) { mainEl = el; break; }
  }
  const mainText = mainEl
    ? (mainEl.innerText ?? mainEl.textContent ?? '')
    : fullText;

  // Truncate to ~12 000 chars to stay within Claude's useful prompt window
  const truncated = mainText.slice(0, 12000);

  // Extract all links — useful for form detection
  const links = Array.from(doc.querySelectorAll('a[href]'))
    .map(a => ({ text: a.textContent.trim(), href: a.href }))
    .filter(l => l.href && l.text.length < 120);

  return { rawText: truncated, links, fullText: fullText.slice(0, 3000) };
}


// ─── 2. REGEX FAST-PATH ───────────────────────────────────────────────────────
//
// Runs before any API call. Handles the ~40% of pages with consistent
// Croatian government HTML patterns. Returns partial PageData; Claude fills gaps.

const HOUR_PATTERNS = [
  // "Ponedjeljak–petak: 08:00–16:00"
  /ponedjeljak[^\d]*(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/i,
  // "Mon-Fri 8:00-16:00"
  /mon(?:day)?[^\d]*(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/i,
  // Radno vrijeme: 08-16h
  /radno\s+vrijeme[^\d]*(\d{1,2})[^\d]+(\d{1,2})\s*h/i,
];

const PHONE_PATTERN   = /(?:\+385|00385|0)[\s\-]?(?:\d[\s\-]?){7,11}/g;
const EMAIL_PATTERN   = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const POSTAL_PATTERN  = /\b1[0-9]{4}\b/;  // Zagreb-area postal codes
const FEE_PATTERN     = /(\d[\d.,]*)\s*(kn|€|eur|hrk|kuna)/gi;

export function regexFastPath(rawText, links, sourceUrl) {
  const partial = {
    contact: { phone: [], email: [], fax: null, address: null, postal_code: null, maps_query: null },
    hours:   { raw: null },
    fees:    [],
    forms:   [],
    _meta:   { strategy: 'regex', confidence: 0, warnings: [] },
  };

  // Phones
  const phones = rawText.match(PHONE_PATTERN) ?? [];
  partial.contact.phone = [...new Set(phones.map(p => p.trim()))].slice(0, 4);

  // Emails
  const emails = rawText.match(EMAIL_PATTERN) ?? [];
  partial.contact.email = [...new Set(emails)].filter(e => !e.includes('example')).slice(0, 3);

  // Postal code
  const postal = rawText.match(POSTAL_PATTERN);
  if (postal) partial.contact.postal_code = postal[0];

  // Hours — extract the raw block containing "radno vrijeme"
  const hoursIdx = rawText.toLowerCase().indexOf('radno vrijem');
  if (hoursIdx !== -1) {
    partial.hours.raw = rawText.slice(hoursIdx, hoursIdx + 300).replace(/\s+/g, ' ');
  }

  // Fees — find all price mentions
  let feeMatch;
  const feeRe = new RegExp(FEE_PATTERN.source, 'gi');
  while ((feeMatch = feeRe.exec(rawText)) !== null) {
    const raw = feeMatch[0];
    const amount = parseFloat(feeMatch[1].replace(',', '.'));
    const currency = feeMatch[2].toLowerCase() === 'kn' ? 'HRK' : 'EUR';
    // Get a bit of context around the match for the label
    const ctxStart = Math.max(0, feeMatch.index - 80);
    const ctx = rawText.slice(ctxStart, feeMatch.index).trim();
    const label = ctx.split(/[\n.;]/).pop()?.trim() ?? raw;
    partial.fees.push({ label: label.slice(-60), amount, currency, note: null });
  }

  // Forms — detect PDF/DOCX links
  const formLinks = links.filter(l => {
    const href = l.href.toLowerCase();
    return href.includes('.pdf') || href.includes('.docx') ||
           href.includes('/form') || href.includes('/obrazac') ||
           href.includes('/zahtjev');
  });
  partial.forms = formLinks.slice(0, 8).map(l => ({
    title: l.text || 'Form',
    url:   l.href,
    type:  l.href.toLowerCase().includes('.pdf') ? 'pdf'
         : l.href.toLowerCase().includes('.docx') ? 'docx' : 'html',
    fillable: null,
  }));

  // Rough confidence based on how much we found
  const found = (partial.contact.phone.length > 0 ? 1 : 0)
              + (partial.contact.email.length > 0 ? 1 : 0)
              + (partial.hours.raw ? 1 : 0)
              + (partial.fees.length > 0 ? 1 : 0);
  partial._meta.confidence = found / 4;

  return partial;
}


// ─── 3. CLAUDE EXTRACTION PROMPT ─────────────────────────────────────────────
//
// The main prompt. Sent to claude-sonnet with the cleaned page text.
// Pre-seeds whatever regex already found so Claude doesn't re-derive it.
// Returns a complete PageData JSON.

export function buildExtractionPrompt({ rawText, links, partialData, intentResult }) {
  const intent      = intentResult?.intentLabel ?? 'general';
  const city        = intentResult?.city ?? 'Croatia';
  const language    = intentResult?.language ?? 'hr';
  const formLinks   = links
    .filter(l => /\.(pdf|docx)|\/form|\/obrazac|\/zahtjev/i.test(l.href))
    .slice(0, 10)
    .map(l => `  - "${l.text}" → ${l.href}`)
    .join('\n') || '  (none detected)';

  const preseeded = JSON.stringify({
    contact: partialData.contact,
    hours:   partialData.hours,
    fees:    partialData.fees,
    forms:   partialData.forms,
  }, null, 2);

  return `You are a structured data extractor for a Croatian civic information assistant.

## Task
Extract all useful civic information from the government page text below.
The user's intent is: ${intent}. City context: ${city}.

## Already extracted (do NOT re-derive, copy exactly into your output)
\`\`\`json
${preseeded}
\`\`\`

## Detected form/download links on the page
${formLinks}

## Page text
---
${rawText}
---

## Output
Return ONLY a single valid JSON object matching this exact schema.
No markdown fences. No prose. No explanations. No trailing commas.

\`\`\`
{
  "office_name": string | null,
  "department": string | null,
  "city": string | null,
  "source_url": string | null,

  "hours": {
    "monday": string | null,     // format "HH:MM–HH:MM", null if closed
    "tuesday": string | null,
    "wednesday": string | null,
    "thursday": string | null,
    "friday": string | null,
    "saturday": string | null,
    "sunday": string | null,
    "note": string | null,       // e.g. "Closed on public holidays"
    "raw": string | null         // copy from pre-seeded if present
  },

  "contact": {
    "phone": string[],           // copy from pre-seeded, add any new ones
    "email": string[],
    "fax": string | null,
    "address": string | null,
    "postal_code": string | null,
    "maps_query": string | null  // address formatted for Google Maps URL
  },

  "required_documents": [
    {
      "name": string,            // e.g. "Osobna iskaznica / ID card"
      "note": string | null,     // e.g. "Original and 1 copy"
      "mandatory": boolean
    }
  ],

  "fees": [
    {
      "label": string,
      "amount": number | null,
      "currency": "EUR" | "HRK" | "USD" | null,
      "note": string | null
    }
  ],

  "process_steps": [
    {
      "step": number,
      "title": string,
      "description": string | null,
      "duration": string | null  // e.g. "3–5 business days"
    }
  ],

  "forms": [
    {
      "title": string,
      "url": string,
      "type": "pdf" | "docx" | "html" | "other",
      "fillable": boolean | null
    }
  ],

  "appointment": {
    "bookable_online": boolean,
    "booking_url": string | null,
    "booking_phone": string | null,
    "notes": string | null
  }
}
\`\`\`

## Rules
- hours: use 24h format with en-dash, e.g. "08:00–16:00". If a day isn't mentioned, use null.
- required_documents: only include explicit requirements stated on the page. Do not invent.
- fees: only include amounts explicitly stated. amount=null if mentioned but not quantified.
- process_steps: extract numbered steps if present. Max 8 steps.
- forms: merge with the pre-seeded list. Deduplicate by URL.
- If a field has no information on the page, use null or [].
- Respond in the same language the page is written in for string values (${language === 'hr' ? 'Croatian' : 'English'}).
- maps_query: combine address + city for a clean Google Maps search string.`;
}


// ─── 4. SCHEMA VALIDATOR ─────────────────────────────────────────────────────
//
// Checks Claude's JSON against the expected shape.
// Returns { valid: boolean, errors: string[], repairHints: string }

export function validatePageData(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response is not an object'], warnings, repairHints: '' };
  }

  // Required top-level keys
  const requiredKeys = ['hours', 'contact', 'required_documents', 'fees', 'process_steps', 'forms', 'appointment'];
  for (const key of requiredKeys) {
    if (!(key in data)) errors.push(`Missing key: "${key}"`);
  }

  // hours
  if (data.hours && typeof data.hours !== 'object') {
    errors.push('"hours" must be an object');
  }

  // contact arrays
  if (data.contact) {
    if (!Array.isArray(data.contact.phone)) errors.push('"contact.phone" must be array');
    if (!Array.isArray(data.contact.email)) errors.push('"contact.email" must be array');
  }

  // Array fields
  for (const key of ['required_documents', 'fees', 'process_steps', 'forms']) {
    if (data[key] !== undefined && !Array.isArray(data[key])) {
      errors.push(`"${key}" must be an array`);
    }
  }

  // required_documents items
  if (Array.isArray(data.required_documents)) {
    data.required_documents.forEach((doc, i) => {
      if (typeof doc.name !== 'string') errors.push(`required_documents[${i}].name must be string`);
      if (typeof doc.mandatory !== 'boolean') warnings.push(`required_documents[${i}].mandatory not boolean`);
    });
  }

  // fees items
  if (Array.isArray(data.fees)) {
    data.fees.forEach((fee, i) => {
      if (typeof fee.label !== 'string') errors.push(`fees[${i}].label must be string`);
      if (fee.amount !== null && typeof fee.amount !== 'number') {
        warnings.push(`fees[${i}].amount should be number or null, got ${typeof fee.amount}`);
        // Attempt coercion
        data.fees[i].amount = parseFloat(fee.amount) || null;
      }
    });
  }

  // forms items
  if (Array.isArray(data.forms)) {
    data.forms.forEach((form, i) => {
      if (!form.url) errors.push(`forms[${i}] missing url`);
      if (!['pdf','docx','html','other'].includes(form.type)) {
        warnings.push(`forms[${i}].type "${form.type}" unknown, defaulting to "other"`);
        data.forms[i].type = 'other';
      }
    });
  }

  // appointment
  if (data.appointment && typeof data.appointment.bookable_online !== 'boolean') {
    warnings.push('"appointment.bookable_online" not boolean, defaulting to false');
    if (data.appointment) data.appointment.bookable_online = false;
  }

  const repairHints = errors.length > 0
    ? `Fix these issues and return corrected JSON:\n${errors.map(e => `- ${e}`).join('\n')}`
    : '';

  return { valid: errors.length === 0, errors, warnings, repairHints };
}


// ─── 5. REPAIR PROMPT ────────────────────────────────────────────────────────
//
// Sent to Claude when validation fails. Cheaper than re-running full extraction.

export function buildRepairPrompt(badJson, validationErrors) {
  return `The following JSON has schema errors. Fix ONLY the errors listed and return corrected JSON.
Do not change any other values. Do not add prose. Return only valid JSON.

Errors to fix:
${validationErrors.map(e => `- ${e}`).join('\n')}

JSON to fix:
${badJson}`;
}


// ─── 6. VISION FALLBACK ───────────────────────────────────────────────────────
//
// Used when the page is JS-rendered or the text extraction yields too little.
// Takes a screenshot (base64) and runs the extraction prompt on the image.

export function buildVisionExtractionPrompt({ intentResult }) {
  const intent = intentResult?.intentLabel ?? 'general information';
  return `You are extracting structured civic data from a screenshot of a Croatian government website.

The user needs: ${intent}

Carefully read all text visible in the image and extract a JSON object with this schema:

{
  "office_name": string | null,
  "hours": {
    "monday": string | null, "tuesday": string | null, "wednesday": string | null,
    "thursday": string | null, "friday": string | null, "saturday": string | null,
    "sunday": string | null, "note": string | null, "raw": string | null
  },
  "contact": {
    "phone": string[], "email": string[], "fax": string | null,
    "address": string | null, "postal_code": string | null, "maps_query": string | null
  },
  "required_documents": [{ "name": string, "note": string | null, "mandatory": boolean }],
  "fees": [{ "label": string, "amount": number | null, "currency": string | null, "note": string | null }],
  "forms": [{ "title": string, "url": string, "type": "pdf"|"docx"|"html"|"other", "fillable": boolean | null }],
  "appointment": { "bookable_online": boolean, "booking_url": string | null, "booking_phone": string | null, "notes": string | null }
}

Return ONLY valid JSON. No markdown. No prose.`;
}


// ─── 7. CLAUDE API HELPERS ───────────────────────────────────────────────────

async function callClaude({ prompt, imageBase64 = null, maxTokens = 2000 }) {
  const content = imageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
        { type: 'text', text: prompt },
      ]
    : prompt;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: 'You are a structured data extraction API. Respond only with valid JSON. No markdown fences.',
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error ${response.status}`);
  const data = await response.json();
  const raw  = data.content?.map(b => b.text ?? '').join('') ?? '';
  // Strip accidental markdown fences
  return raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
}

function safeParseJson(text) {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (e) {
    // Try stripping common Claude preamble
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return { ok: true, data: JSON.parse(match[0]) }; } catch (_) {}
    }
    return { ok: false, error: e.message };
  }
}


// ─── 8. MAIN ORCHESTRATOR ────────────────────────────────────────────────────
//
// Call this from your app. Returns a validated PageData object.
//
// Usage:
//   const pageData = await extractPageData({
//     html: scrapedHtml,
//     sourceUrl: 'https://www.zagreb.hr/gradjevinska-dozvola/...',
//     intentResult,           // from civic-intent-detection.js
//     screenshotBase64: null, // optional — provide if page is JS-rendered
//   });

export async function extractPageData({
  html,
  sourceUrl,
  intentResult,
  screenshotBase64 = null,
}) {
  const warnings = [];
  const startTs  = new Date().toISOString();

  // ── Step 1: Pre-process HTML ──────────────────────────────────────────────
  const { rawText, links } = preprocessHtml(html);
  const textLength = rawText.trim().length;

  // ── Step 2: Regex fast-path ───────────────────────────────────────────────
  const partial = regexFastPath(rawText, links, sourceUrl);

  // If regex got us ≥75% confidence and intent only needs basic info, skip Claude
  if (partial._meta.confidence >= 0.75 && intentResult?.intent === 'info') {
    return {
      ...partial,
      office_name: null,
      department: null,
      city: intentResult?.city ?? null,
      source_url: sourceUrl,
      required_documents: [],
      process_steps: [],
      appointment: { bookable_online: false, booking_url: null, booking_phone: null, notes: null },
      _meta: {
        strategy: 'regex',
        confidence: partial._meta.confidence,
        extraction_ts: startTs,
        warnings,
      },
    };
  }

  // ── Step 3: Claude text extraction ───────────────────────────────────────
  let rawJson, parsed, strategy;

  if (textLength > 100) {
    const prompt = buildExtractionPrompt({ rawText, links, partialData: partial, intentResult });

    try {
      rawJson  = await callClaude({ prompt, maxTokens: 2000 });
      parsed   = safeParseJson(rawJson);
      strategy = 'claude-text';

      if (!parsed.ok) {
        warnings.push(`JSON parse failed on text extraction: ${parsed.error}`);
        parsed = { ok: false };
      }
    } catch (e) {
      warnings.push(`Claude text extraction failed: ${e.message}`);
      parsed = { ok: false };
    }
  } else {
    warnings.push('Page text too short (<100 chars) — skipping text extraction');
    parsed = { ok: false };
  }

  // ── Step 4: Vision fallback ───────────────────────────────────────────────
  if (!parsed.ok && screenshotBase64) {
    strategy = 'claude-vision';
    try {
      const visionPrompt = buildVisionExtractionPrompt({ intentResult });
      rawJson = await callClaude({ prompt: visionPrompt, imageBase64: screenshotBase64, maxTokens: 1500 });
      parsed  = safeParseJson(rawJson);
      if (!parsed.ok) warnings.push(`Vision JSON parse failed: ${parsed.error}`);
    } catch (e) {
      warnings.push(`Vision extraction failed: ${e.message}`);
    }
  }

  // ── Step 5: Validate + repair ─────────────────────────────────────────────
  let finalData = parsed?.data ?? {};

  const validation = validatePageData(finalData);

  if (!validation.valid && rawJson) {
    // One repair attempt
    try {
      const repairPrompt = buildRepairPrompt(rawJson, validation.errors);
      const repairedJson = await callClaude({ prompt: repairPrompt, maxTokens: 1000 });
      const repaired     = safeParseJson(repairedJson);
      if (repaired.ok) {
        finalData = repaired.data;
        warnings.push(`Auto-repaired ${validation.errors.length} schema error(s)`);
      } else {
        warnings.push('Repair attempt failed — using best-effort data');
      }
    } catch (e) {
      warnings.push(`Repair call failed: ${e.message}`);
    }
  }

  // ── Step 6: Merge regex partial into Claude output ────────────────────────
  // Regex extractions for phones/emails are often more reliable (direct regex vs LLM)
  if (partial.contact.phone.length > 0 && (!finalData.contact?.phone?.length)) {
    if (finalData.contact) finalData.contact.phone = partial.contact.phone;
  }
  if (partial.contact.email.length > 0 && (!finalData.contact?.email?.length)) {
    if (finalData.contact) finalData.contact.email = partial.contact.email;
  }
  // Merge forms without duplicates
  if (partial.forms.length > 0 && Array.isArray(finalData.forms)) {
    const existingUrls = new Set(finalData.forms.map(f => f.url));
    const newForms = partial.forms.filter(f => !existingUrls.has(f.url));
    finalData.forms = [...finalData.forms, ...newForms];
  }

  // ── Step 7: Finalize ──────────────────────────────────────────────────────
  // Ensure all top-level keys exist
  const defaults = {
    office_name: null, department: null,
    city: intentResult?.city ?? null,
    source_url: sourceUrl,
    hours: { monday: null, tuesday: null, wednesday: null, thursday: null,
             friday: null, saturday: null, sunday: null, note: null, raw: null },
    contact: { phone: [], email: [], fax: null, address: null,
               postal_code: null, maps_query: null },
    required_documents: [],
    fees: [],
    process_steps: [],
    forms: [],
    appointment: { bookable_online: false, booking_url: null,
                   booking_phone: null, notes: null },
  };

  const result = { ...defaults, ...finalData };

  // Compute overall confidence
  const filled = [
    result.office_name,
    result.hours?.monday ?? result.hours?.raw,
    result.contact?.phone?.length > 0,
    result.contact?.address,
    result.required_documents?.length > 0,
  ].filter(Boolean).length;
  const confidence = filled / 5;

  result._meta = {
    strategy: strategy ?? 'regex',
    confidence,
    extraction_ts: startTs,
    warnings: [...(partial._meta.warnings ?? []), ...warnings, ...(validation.warnings ?? [])],
  };

  return result;
}


// ─── 9. HOURS PARSER UTILITY ─────────────────────────────────────────────────
//
// Converts the hours object into structured display data for the hours card.
// Also computes isOpenNow given the current local time.

const DAYS_HR = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function parseHoursForDisplay(hours) {
  if (!hours) return null;

  const now = new Date();
  const todayIndex = now.getDay(); // 0=Sun
  const todayKey   = DAYS_HR[todayIndex];
  const todayHours = hours[todayKey];

  let isOpenNow = false;
  if (todayHours) {
    const match = todayHours.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (match) {
      const openH  = parseInt(match[1]), openM  = parseInt(match[2]);
      const closeH = parseInt(match[3]), closeM = parseInt(match[4]);
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const openMins  = openH  * 60 + openM;
      const closeMins = closeH * 60 + closeM;
      isOpenNow = nowMins >= openMins && nowMins < closeMins;
    }
  }

  const schedule = DAYS_HR.map((key, i) => ({
    day:    DAYS_EN[i],
    dayHr:  key,
    hours:  hours[key] ?? null,
    isToday: i === todayIndex,
    isClosed: !hours[key],
  }));

  return { schedule, isOpenNow, todayHours, note: hours.note };
}