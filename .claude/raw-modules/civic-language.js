/**
 * civic-language.js
 *
 * Language enforcement module.
 *
 * Responsibilities:
 *   1. detect()          — classify query language (hr / en / mixed)
 *   2. normalise()       — strip mixed-language noise before intent detection
 *   3. systemPrompt()    — inject language instruction into every Claude call
 *   4. enforceOnResult() — post-process Claude answer to verify language match
 *   5. formatFor()       — locale-specific formatting (dates, currency, phones)
 */

// ─── SUPPORTED LANGUAGES ─────────────────────────────────────────────────────

export const LANGUAGES = {
  hr: { name: "Croatian", locale: "hr-HR", flag: "🇭🇷" },
  en: { name: "English",  locale: "en-GB", flag: "🇬🇧" },
};

// ─── 1. DETECTION ─────────────────────────────────────────────────────────────

/**
 * Strong Croatian signals — diacritics and high-frequency function words
 * that are unambiguously Croatian and rarely appear in English.
 */
const HR_STRONG = [
  // Diacritic characters (presence alone is strong signal)
  /[čćšđžČĆŠĐŽ]/,
  // High-frequency Croatian words
  /\b(sam|je|su|se|za|na|od|do|po|uz|što|koji|koja|koje|kako|gdje|kada|imam|imam|trebam|moram|mogu|hoću|želim|molim)\b/i,
];

/**
 * Moderate Croatian signals — common civic terms without diacritics.
 * Each match shifts probability toward HR.
 */
const HR_MODERATE = [
  /\b(radno|vrijeme|dozvola|naknada|zahtjev|obrazac|ured|grad|opcina|zupanije|plaćanje|placanje|dokument|osobna|putovnica|iskaznica|vozacka|obrt|termin|prijava|prituzba|komunalna|gradnja|zgrada|stan|kuca|ulica)\b/i,
];

/**
 * Strong English signals — common English function words that don't
 * appear in Croatian.
 */
const EN_STRONG = [
  /\b(the|is|are|was|were|have|has|had|will|would|could|should|does|do|did|this|that|these|those|with|from|they|their|there|here|when|where|what|how|who|why|can|get|need|want|please)\b/i,
];

/**
 * Returns { language: 'hr'|'en', confidence: 0–1, breakdown: {} }
 */
export function detectLanguage(text) {
  const t = text.trim();
  if (!t) return { language: "hr", confidence: 0.5, breakdown: {} };

  let hrScore = 0;
  let enScore = 0;

  // Strong HR signals
  for (const pattern of HR_STRONG) {
    const matches = t.match(new RegExp(pattern.source, "gi")) ?? [];
    hrScore += matches.length * 3;
  }

  // Moderate HR signals
  for (const pattern of HR_MODERATE) {
    const matches = t.match(new RegExp(pattern.source, "gi")) ?? [];
    hrScore += matches.length * 1;
  }

  // Strong EN signals
  for (const pattern of EN_STRONG) {
    const matches = t.match(new RegExp(pattern.source, "gi")) ?? [];
    enScore += matches.length * 2;
  }

  const total = hrScore + enScore;

  if (total === 0) {
    // No signal — default to HR for Croatian civic context
    return { language: "hr", confidence: 0.5, breakdown: { hrScore, enScore } };
  }

  const hrRatio = hrScore / total;

  // Mixed: neither side has clear dominance (40–60%)
  const isMixed = hrRatio > 0.35 && hrRatio < 0.65;
  const language = hrRatio >= 0.5 ? "hr" : "en";
  const confidence = isMixed
    ? 0.5
    : language === "hr"
      ? Math.min(0.5 + hrRatio * 0.6, 0.95)
      : Math.min(0.5 + (1 - hrRatio) * 0.6, 0.95);

  return { language, confidence, isMixed, breakdown: { hrScore, enScore } };
}


// ─── 2. NORMALISATION ─────────────────────────────────────────────────────────

/**
 * Mixed-language patterns: English structure with Croatian nouns,
 * or Croatian structure with English civic terms.
 *
 * Each entry: [pattern, replacement]
 * Replacements use Croatian official terminology.
 */
const MIXED_NORMALISATIONS = [
  // "I need a putovnica"  →  "Trebam putovnicu"
  [/\bI need (?:a |an |my )?(putovnica|osobna|domovnica|rodni list|vozačka)\b/gi,
   (_, doc) => `Trebam ${doc}`],

  // "gdje mogu get osobna"  →  "gdje mogu dobiti osobnu iskaznicu"
  [/\bget (osobna|putovnica|dozvola)\b/gi,
   (_, doc) => `dobiti ${doc}`],

  // "How do I platiti komunalnu"  →  "Kako platiti komunalnu naknadu"
  [/\bhow do I (platiti|zakazati|prijaviti|dobiti)\b/gi,
   (_, verb) => `Kako ${verb}`],

  // "trebam building permit"  →  "trebam građevinsku dozvolu"
  [/\bbuilding permit\b/gi, "građevinsku dozvolu"],
  [/\btrade licen[cs]e\b/gi, "obrtnu dozvolu"],
  [/\bdriving licen[cs]e\b/gi, "vozačku dozvolu"],
  [/\bpassport\b/gi,            "putovnicu"],
  [/\bid card\b/gi,             "osobnu iskaznicu"],
  [/\bbirth certificate\b/gi,   "rodni list"],
  [/\bworking hours\b/gi,       "radno vrijeme"],
];

/**
 * Normalises a mixed-language query toward dominant language.
 * If fully HR or fully EN, returns input unchanged.
 * If mixed, translates the minority-language fragments.
 */
export function normaliseQuery(text, detectedLanguage) {
  const { isMixed } = detectLanguage(text);
  if (!isMixed) return text;

  let normalised = text;

  if (detectedLanguage === "hr") {
    // Translate English fragments into Croatian
    for (const [pattern, replacement] of MIXED_NORMALISATIONS) {
      normalised = normalised.replace(pattern, replacement);
    }
  }
  // Future: EN direction (translate HR civic terms into EN equivalents)

  return normalised;
}


// ─── 3. SYSTEM PROMPT INJECTION ───────────────────────────────────────────────

/**
 * Returns the language-enforcement block to prepend to every Claude system prompt.
 *
 * Usage:
 *   const system = languageSystemPrompt(lang) + "\n\n" + yourOtherInstructions;
 */
export function languageSystemPrompt(language) {
  if (language === "hr") {
    return `LANGUAGE RULE (highest priority — overrides all other instructions):
The user is communicating in Croatian. You MUST respond entirely in Croatian.
- All prose, labels, explanations, and card content: Croatian
- Official document names: use the Croatian name first, English in parentheses if helpful
  e.g. "osobna iskaznica (ID card)", "rodni list (birth certificate)"
- Hours format: "08:00–16:00" (24h, en-dash)
- Currency: EUR (€) — never HRK/kn unless the fee is explicitly stated in HRK
- Dates: DD.MM.YYYY
- Do NOT switch to English mid-response, even for technical terms
- If you are unsure of a Croatian term, use the term and add "(hrv.)" marker`;
  }

  return `LANGUAGE RULE (highest priority — overrides all other instructions):
The user is communicating in English. You MUST respond entirely in English.
- All prose, labels, explanations, and card content: English
- Croatian document names: English first, Croatian in parentheses
  e.g. "ID card (osobna iskaznica)", "birth certificate (rodni list)"
- Hours format: "8:00 AM – 4:00 PM" or "08:00–16:00" (24h acceptable)
- Currency: EUR (€)
- Dates: DD/MM/YYYY or "15 May 2026"
- Do NOT switch to Croatian mid-response`;
}

/**
 * Injects the language rule into an existing system prompt string.
 * Prepends — language rule wins over any conflicting instruction below it.
 */
export function injectLanguageRule(existingSystemPrompt, language) {
  return `${languageSystemPrompt(language)}\n\n---\n\n${existingSystemPrompt}`;
}


// ─── 4. POST-PROCESS VERIFICATION ────────────────────────────────────────────

/**
 * Quick heuristic check: did Claude actually reply in the requested language?
 * Returns { correct: boolean, detectedIn: string }
 *
 * Not a hard gate — used for logging / telemetry and to decide whether
 * to attempt a lightweight language correction pass.
 */
export function verifyResponseLanguage(responseText, expectedLanguage) {
  const { language: detectedIn, confidence } = detectLanguage(responseText);

  // Low-confidence detection (short responses, numbers, URLs) → assume correct
  if (confidence < 0.6) return { correct: true, detectedIn, confidence };

  return {
    correct:    detectedIn === expectedLanguage,
    detectedIn,
    confidence,
  };
}

/**
 * Builds a short correction prompt when verifyResponseLanguage returns false.
 * Sends the bad response back to Claude with a firm instruction.
 */
export function buildCorrectionPrompt(badResponse, targetLanguage) {
  const langName = LANGUAGES[targetLanguage]?.name ?? targetLanguage;
  return `The following response was written in the wrong language.
Translate it entirely into ${langName}. Keep all factual content identical.
Do not add, remove, or change any information — only the language changes.

Text to translate:
${badResponse}`;
}


// ─── 5. LOCALE FORMATTING ─────────────────────────────────────────────────────

/**
 * Format a currency amount for the correct locale.
 *   formatCurrency(4.5, "EUR", "hr") → "4,50 €"
 *   formatCurrency(4.5, "EUR", "en") → "€4.50"
 */
export function formatCurrency(amount, currency = "EUR", language = "hr") {
  if (amount == null) return null;
  const locale = LANGUAGES[language]?.locale ?? "hr-HR";
  return new Intl.NumberFormat(locale, {
    style:    "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date string for the correct locale.
 *   formatDate("2026-05-15", "hr") → "15. 5. 2026."
 *   formatDate("2026-05-15", "en") → "15/05/2026"
 */
export function formatDate(isoDate, language = "hr") {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (isNaN(d)) return isoDate;
  const locale = LANGUAGES[language]?.locale ?? "hr-HR";
  return d.toLocaleDateString(locale);
}

/**
 * Format a phone number for display.
 * Croatian numbers: +385 1 234 5678
 */
export function formatPhone(raw, language = "hr") {
  if (!raw) return null;
  // Normalise to +385 prefix
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("385") && digits.length >= 10) {
    const local = digits.slice(3);
    return `+385 ${local.slice(0, local.length > 7 ? 2 : 1)} ${local.slice(local.length > 7 ? 2 : 1, -4)} ${local.slice(-4)}`;
  }
  if (digits.startsWith("0") && digits.length >= 8) {
    return digits.replace(/^0(\d{1,2})(\d{3,4})(\d{3,4})$/, "0$1 $2 $3");
  }
  return raw; // return as-is if unrecognised
}

/**
 * Translate UI labels that appear in the output modules.
 * Used by ExtractionPreview and other card components.
 */
export const UI_LABELS = {
  hr: {
    openNow:          "Otvoreno",
    closedNow:        "Zatvoreno",
    opensAt:          "Otvara u",
    closed:           "Zatvoreno",
    requiredDocs:     "Potrebna dokumentacija",
    fees:             "Naknade",
    forms:            "Obrasci i preuzimanja",
    contact:          "Kontakt",
    workingHours:     "Radno vrijeme",
    bookAppointment:  "Zakaži termin",
    openInMaps:       "Otvori u Google Maps",
    fillable:         "Ispunjivo online",
    mandatory:        "Obavezno",
    optional:         "Neobavezno",
    seeOffice:        "na šalteru",
    today:            "Danas",
    monday:           "Ponedjeljak",
    tuesday:          "Utorak",
    wednesday:        "Srijeda",
    thursday:         "Četvrtak",
    friday:           "Petak",
    saturday:         "Subota",
    sunday:           "Nedjelja",
  },
  en: {
    openNow:          "Open now",
    closedNow:        "Closed",
    opensAt:          "Opens at",
    closed:           "Closed",
    requiredDocs:     "Required documents",
    fees:             "Fees",
    forms:            "Forms & downloads",
    contact:          "Contact",
    workingHours:     "Working hours",
    bookAppointment:  "Book appointment",
    openInMaps:       "Open in Google Maps",
    fillable:         "Fillable online",
    mandatory:        "Required",
    optional:         "Optional",
    seeOffice:        "ask at office",
    today:            "Today",
    monday:           "Monday",
    tuesday:          "Tuesday",
    wednesday:        "Wednesday",
    thursday:         "Thursday",
    friday:           "Friday",
    saturday:         "Saturday",
    sunday:           "Sunday",
  },
};

/**
 * Returns the label set for a given language.
 * Usage: const L = getLabels(language);  →  L.openNow, L.fees, …
 */
export function getLabels(language = "hr") {
  return UI_LABELS[language] ?? UI_LABELS.hr;
}