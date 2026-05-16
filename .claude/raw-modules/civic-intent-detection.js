/**
 * civic-intent-detection.js
 *
 * Two-stage intent detection for civic queries:
 *   Stage 1 — Fast keyword classifier (zero latency, no API cost)
 *   Stage 2 — Claude structured extraction (only runs if stage 1 is confident)
 *
 * Outputs a structured IntentResult that drives which UI modules to render.
 */

// ─── INTENT TAXONOMY ──────────────────────────────────────────────────────────
//
// Each intent defines:
//   keywords   — scored keyword list for fast pre-classification
//   slots      — data fields to extract from the query
//   modules    — which output modules to activate
//   minSlots   — if fewer than this many slots are filled, ask a clarifying Q

export const INTENTS = {
  permit: {
    label: 'Permit / licence',
    description: 'User wants to apply for or renew a permit, licence, or official approval',
    keywords: {
      hr: ['dozvola', 'građevinska dozvola', 'lokacijska dozvola', 'odobrenje', 'licenca',
           'obrt', 'registracija obrta', 'djelatnost', 'izgradnja', 'rekonstrukcija',
           'legalizacija', 'natpis', 'terasa', 'postavljanje'],
      en: ['permit', 'building permit', 'licence', 'license', 'approval', 'construction',
           'trade licence', 'business registration', 'signage permit'],
    },
    slots: ['permit_type', 'property_address', 'project_description', 'urgency'],
    modules: ['hours', 'checklist', 'form_prefill', 'map', 'process_timeline', 'fee_calculator', 'contact'],
    minSlots: 1,
    clarifyQuestion: 'What kind of permit do you need? (e.g. building, trade licence, signage)',
  },

  payment: {
    label: 'Payment / fee',
    description: 'User wants to pay a fee, tax, utility bill, or fine',
    keywords: {
      hr: ['platiti', 'plaćanje', 'uplata', 'naknada', 'komunalna naknada', 'porez',
           'taksa', 'kazna', 'globu', 'glopu', 'račun', 'režije', 'komunalije', 'obveza'],
      en: ['pay', 'payment', 'fee', 'tax', 'fine', 'utility bill', 'invoice',
           'utility', 'charge', 'dues'],
    },
    slots: ['fee_type', 'reference_number', 'amount', 'deadline', 'payment_method'],
    modules: ['hours', 'fee_calculator', 'contact'],
    minSlots: 1,
    clarifyQuestion: 'Which fee are you trying to pay? (e.g. communal fee, property tax, parking fine)',
  },

  appointment: {
    label: 'Appointment',
    description: 'User wants to book, reschedule or cancel an appointment at a civic office',
    keywords: {
      hr: ['termin', 'zakazati', 'naručiti', 'rezervirati', 'matičar', 'šalter',
           'registracija', 'vjenčanje', 'krštenje', 'naručivanje', 'slobodan termin'],
      en: ['appointment', 'book', 'schedule', 'reserve', 'civil registry', 'register',
           'slot', 'available', 'next available', 'meeting'],
    },
    slots: ['service_type', 'preferred_date', 'preferred_time', 'num_people'],
    modules: ['hours', 'appointment_finder', 'map', 'contact'],
    minSlots: 1,
    clarifyQuestion: 'What service do you need an appointment for?',
  },

  document: {
    label: 'Document / certificate',
    description: 'User needs to obtain, renew, or verify an official document or certificate',
    keywords: {
      hr: ['rodni list', 'domovnica', 'putovnica', 'osobna iskaznica', 'vozačka dozvola',
           'izvod', 'uvjerenje', 'potvrda', 'kopija', 'ovjera', 'legalizacija', 'apostille',
           'vjenčani list', 'smrtni list', 'boravišna dozvola', 'OIB'],
      en: ['birth certificate', 'passport', 'id card', 'driving licence', 'certificate',
           'document', 'extract', 'confirmation', 'apostille', 'residence permit',
           'marriage certificate', 'death certificate'],
    },
    slots: ['document_type', 'purpose', 'urgency', 'num_copies', 'for_whom'],
    modules: ['hours', 'checklist', 'form_prefill', 'fee_calculator', 'map', 'contact'],
    minSlots: 1,
    clarifyQuestion: 'Which document do you need? (e.g. birth certificate, passport, ID card)',
  },

  complaint: {
    label: 'Complaint / report',
    description: 'User wants to report a problem, file a complaint, or submit a grievance',
    keywords: {
      hr: ['prijava', 'pritužba', 'žalba', 'problem', 'kvar', 'rupa', 'buka', 'smrad',
           'divlje odlaganje', 'nepropisno parkiranje', 'neosvijetljeno', 'oštećenje',
           'vandalizm', 'graffiti', 'zamjena', 'popravak'],
      en: ['complaint', 'report', 'problem', 'broken', 'noise', 'pothole', 'illegal',
           'dumping', 'parking', 'graffiti', 'damage', 'repair', 'issue', 'hazard'],
    },
    slots: ['complaint_type', 'location', 'description', 'urgency', 'photo_available'],
    modules: ['contact', 'map', 'process_timeline'],
    minSlots: 2,
    clarifyQuestion: 'What problem are you reporting, and where is it located?',
  },

  info: {
    label: 'General info',
    description: 'User wants information — working hours, location, procedures, eligibility',
    keywords: {
      hr: ['radno vrijeme', 'kada', 'gdje', 'kako', 'što', 'tko', 'informacija',
           'koliko košta', 'trebam li', 'mogu li', 'je li moguće', 'otvoreno'],
      en: ['working hours', 'when', 'where', 'how', 'what', 'who', 'info', 'information',
           'open', 'cost', 'eligible', 'need', 'require', 'do i need', 'can i'],
    },
    slots: ['topic', 'office', 'city'],
    modules: ['hours', 'map', 'contact'],
    minSlots: 1,
    clarifyQuestion: 'Are you looking for information, or do you need to take a specific action?',
  },
};


// ─── STAGE 1: KEYWORD CLASSIFIER ─────────────────────────────────────────────

/**
 * Fast local classification — runs synchronously, zero API cost.
 * Returns the best-matching intent and a raw confidence score.
 */
export function classifyByKeywords(query) {
  const q = query.toLowerCase();
  const scores = {};

  for (const [key, intent] of Object.entries(INTENTS)) {
    let score = 0;
    const allKeywords = [...intent.keywords.hr, ...intent.keywords.en];
    for (const kw of allKeywords) {
      if (q.includes(kw)) {
        // Multi-word phrases score higher than single words
        score += kw.split(' ').length > 1 ? 3 : 1;
      }
    }
    scores[key] = score;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  // Confidence = how dominant the best match is over all scores
  const dominance = totalScore > 0 ? best[1] / totalScore : 0;
  const rawScore = best[1];

  return {
    intent: best[0],
    rawScore,
    // Map dominance to a 0.4–0.95 confidence range
    confidence: rawScore === 0 ? 0.3 : Math.min(0.45 + dominance * 0.5, 0.95),
    scores,
  };
}


// ─── STAGE 2: SLOT EXTRACTION ─────────────────────────────────────────────────

/**
 * Extracts structured slots from the query using regex patterns.
 * These are cheap local extractions before handing off to Claude.
 */
const SLOT_PATTERNS = {
  // Document types
  document_type: [
    [/rodni list/i, 'birth certificate'],
    [/domovnica/i, 'citizenship certificate'],
    [/putovnica/i, 'passport'],
    [/osobna iskaznica?/i, 'id card'],
    [/vozačka dozvola/i, 'driving licence'],
    [/vjenčani list/i, 'marriage certificate'],
    [/birth certificate/i, 'birth certificate'],
    [/passport/i, 'passport'],
    [/id card/i, 'id card'],
    [/driving licen[sc]e/i, 'driving licence'],
  ],

  // Permit types
  permit_type: [
    [/građevinska dozvola/i, 'building permit'],
    [/lokacijska dozvola/i, 'location permit'],
    [/obrt|trade licence/i, 'trade licence'],
    [/natpis|signage/i, 'signage permit'],
    [/terasa|terrace/i, 'terrace permit'],
    [/building permit/i, 'building permit'],
  ],

  // Complaint types
  complaint_type: [
    [/rupa|pothole/i, 'pothole'],
    [/buka|noise/i, 'noise complaint'],
    [/divlje odlaganje|illegal dump/i, 'illegal dumping'],
    [/graffiti|vandalizm/i, 'vandalism'],
    [/nepropisno parkiranje|illegal park/i, 'illegal parking'],
    [/smrad|odour/i, 'odour complaint'],
    [/kvar|broken/i, 'infrastructure damage'],
  ],

  // Fee types
  fee_type: [
    [/komunalna naknada|communal fee/i, 'communal fee'],
    [/porez na nekretnine|property tax/i, 'property tax'],
    [/parkiranje|parking/i, 'parking fee'],
    [/kazna|fine/i, 'fine'],
    [/režije|utilities/i, 'utility bill'],
  ],

  // Urgency signals
  urgency: [
    [/hitno|urgent|žurno|asap|brzo|što prije/i, 'urgent'],
  ],

  // Location / address
  location: [
    [/ulica\s+[\wčćšđž]+(?:\s+\d+)?/i, null],  // "Ulica X 12"
    [/[\wčćšđž]+\s+\d+\s*,?\s*zagreb/i, null],
    [/(zagreb|split|rijeka|osijek|zadar|dubrovnik|pula|slavonski brod|karlovac)/i, null],
  ],

  // Number of copies
  num_copies: [
    [/(\d+)\s*(kopij|primjerak|primjerka|kopije|copy|copies)/i, null],
  ],

  // Preferred date
  preferred_date: [
    [/(\d{1,2}[.\-\/]\d{1,2}(?:[.\-\/]\d{2,4})?)/i, null],
    [/sutra|tomorrow/i, 'tomorrow'],
    [/sljedeći tjedan|next week/i, 'next week'],
    [/ovaj tjedan|this week/i, 'this week'],
  ],
};

export function extractSlotsLocally(query, intentKey) {
  const q = query;
  const slots = INTENTS[intentKey].slots;
  const result = {};

  for (const slotKey of slots) {
    const patterns = SLOT_PATTERNS[slotKey] || [];
    let found = null;

    for (const [pattern, label] of patterns) {
      const match = q.match(pattern);
      if (match) {
        found = label ?? match[1] ?? match[0];
        break;
      }
    }

    result[slotKey] = found;
  }

  return result;
}


// ─── STAGE 3: CLAUDE EXTRACTION PROMPT ───────────────────────────────────────

/**
 * Builds the extraction prompt sent to Claude.
 * Pre-seeds already-detected slot values to save Claude effort
 * and reduce hallucination on values we're already certain about.
 */
export function buildExtractionPrompt(query, intentKey, prefilledSlots = {}, language = 'en') {
  const intent = INTENTS[intentKey];
  const slotDefs = intent.slots
    .map(s => `  "${s}": string | null`)
    .join('\n');

  const prefilledLines = Object.entries(prefilledSlots)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `  ${k}: already detected as "${v}"`)
    .join('\n') || '  (none pre-detected)';

  const langInstruction = language === 'hr'
    ? 'The user is writing in Croatian. Extract values in Croatian where appropriate, but use the JSON keys in English.'
    : 'Extract values in English.';

  return `You are a structured data extractor for a Croatian civic assistant.

User query: "${query}"

Detected intent: ${intent.label} — ${intent.description}

${langInstruction}

Extract a JSON object with exactly these fields:
${slotDefs}
  "city": string | null
  "office_name": string | null
  "language": "hr" | "en"
  "is_urgent": boolean
  "needs_clarification": boolean
  "clarification_question": string | null

Rules:
- Copy pre-detected values exactly: do not re-extract or modify them.
${prefilledLines}
- Set "needs_clarification" to true only if the query is too vague to act on.
- If "needs_clarification" is true, set "clarification_question" to a single concise question.
- Return ONLY valid JSON. No markdown fences, no prose, no explanation.`;
}


// ─── STAGE 4: CLAUDE API CALL ─────────────────────────────────────────────────

/**
 * Calls Claude to fill remaining slots and validate the intent.
 * Only called when confidence from stage 1 is >= CONFIDENCE_THRESHOLD.
 */
const CONFIDENCE_THRESHOLD = 0.5;

export async function extractWithClaude(query, intentKey, prefilledSlots, language) {
  const prompt = buildExtractionPrompt(query, intentKey, prefilledSlots, language);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: 'You are a data extraction API. Respond only with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const raw = data.content?.[0]?.text ?? '{}';

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    console.warn('Claude returned non-JSON:', raw);
    return {};
  }
}


// ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────

/**
 * Full intent detection pipeline.
 *
 * Returns an IntentResult:
 * {
 *   intent: string,
 *   confidence: number,
 *   slots: Record<string, string|null>,
 *   modulesToRender: string[],
 *   needsClarification: boolean,
 *   clarificationQuestion: string | null,
 *   language: 'hr' | 'en',
 *   isUrgent: boolean,
 * }
 *
 * Usage:
 *   const result = await detectCivicIntent(userQuery);
 *   // result.modulesToRender tells the UI which cards to show
 */
export async function detectCivicIntent(query) {
  // Stage 1: fast keyword classifier
  const { intent: intentKey, confidence, scores } = classifyByKeywords(query);

  // Detect language
  const croatianSignals = /[čćšđžČĆŠĐŽ]|(?:radno vrijeme|plaćanje|dozvola|naknada|uvjerenje)/;
  const language = croatianSignals.test(query) ? 'hr' : 'en';

  // Extract what we can locally for free
  const localSlots = extractSlotsLocally(query, intentKey);

  // If confidence is too low, ask for clarification without calling Claude
  if (confidence < CONFIDENCE_THRESHOLD) {
    return {
      intent: intentKey,
      confidence,
      slots: localSlots,
      modulesToRender: INTENTS[intentKey].modules,
      needsClarification: true,
      clarificationQuestion: INTENTS[intentKey].clarifyQuestion,
      language,
      isUrgent: false,
      _scores: scores,
    };
  }

  // Stage 2: Claude fills remaining slots
  const claudeSlots = await extractWithClaude(query, intentKey, localSlots, language);

  // Merge: local extractions take priority (higher certainty)
  const mergedSlots = { ...claudeSlots, ...localSlots };

  // Check if enough slots are filled to act
  const intentDef = INTENTS[intentKey];
  const filledCount = intentDef.slots.filter(s => mergedSlots[s]).length;
  const needsClarification = claudeSlots.needs_clarification
    || filledCount < intentDef.minSlots;

  return {
    intent: intentKey,
    intentLabel: intentDef.label,
    confidence,
    slots: mergedSlots,
    modulesToRender: intentDef.modules,
    needsClarification,
    clarificationQuestion: needsClarification
      ? (claudeSlots.clarification_question || intentDef.clarifyQuestion)
      : null,
    language: claudeSlots.language || language,
    isUrgent: claudeSlots.is_urgent || /hitno|urgent|žurno/i.test(query),
    city: claudeSlots.city || null,
    officeName: claudeSlots.office_name || null,
    _scores: scores,
  };
}


// ─── CONVENIENCE: CLARIFICATION HANDLER ──────────────────────────────────────

/**
 * When we need clarification, this builds a one-question follow-up
 * that the UI can display as a prompt suggestion or quick-reply buttons.
 *
 * Returns { question, suggestions[] } where suggestions are tappable chips.
 */
export function buildClarificationUX(intentResult) {
  const { intent } = intentResult;

  const SUGGESTIONS = {
    permit: ['Building permit', 'Trade licence', 'Signage permit', 'Terrace permit'],
    payment: ['Communal fee', 'Property tax', 'Parking fine', 'Other fee'],
    appointment: ['Civil registry', 'Building department', 'Social services', 'MUP/police'],
    document: ['Birth certificate', 'Passport', 'ID card', 'Driving licence'],
    complaint: ['Pothole / road damage', 'Noise', 'Illegal dumping', 'Broken infrastructure'],
    info: ['Working hours', 'Required documents', 'Location & map', 'Process steps'],
  };

  return {
    question: INTENTS[intent].clarifyQuestion,
    suggestions: SUGGESTIONS[intent] || [],
  };
}