import { franc } from 'franc';

export type ChatLanguage = 'hr' | 'en';

export interface LanguageDetection {
  language: ChatLanguage;
  confidence: number;
  isMixed: boolean;
  iso3: string;
  source: 'franc' | 'heuristic' | 'claude-fallback';
}

export interface PreparedLanguageQuery extends LanguageDetection {
  originalText: string;
  normalizedText: string;
  changed: boolean;
}

const LOW_CONFIDENCE_LANGS = new Set(['und', 'afr', 'sot']);
const SLAVIC_ISO3 = new Set(['hrv', 'bos', 'srp']);
const ISO3_TO_CHAT_LANGUAGE: Record<string, ChatLanguage> = {
  eng: 'en',
  hrv: 'hr',
  bos: 'hr',
  srp: 'hr',
};

const HR_STRONG = [
  /[čćšđžČĆŠĐŽ]/,
  /\b(sam|je|su|se|za|na|od|do|po|uz|što|koji|koja|koje|kako|gdje|kada|imam|trebam|moram|mogu|hoću|želim|molim)\b/i,
];

const HR_MODERATE = [
  /\b(radno|vrijeme|dozvola|naknada|zahtjev|obrazac|ured|grad|opcina|zupanije|placanje|dokument|osobna|putovnica|iskaznica|vozacka|obrt|termin|prijava|prituzba|komunalna|gradnja|zgrada|stan|kuca|ulica)\b/i,
];

const HR_CIVIC_INFLECTED = [
  /\b(osobnu|osobne|osobni|osobna)\b/i,
  /\b(iskaznicu|iskaznica|iskaznice)\b/i,
  /\b(karticu|kartica|kartice)\b/i,
  /\b(putovnicu|putovnica|putovnice)\b/i,
  /\b(domovnicu|domovnica|domovnice)\b/i,
  /\b(rodni list|rodnog lista|rodnom listu)\b/i,
];

const EN_STRONG = [
  /\b(the|is|are|was|were|have|has|had|will|would|could|should|does|do|did|this|that|these|those|with|from|they|their|there|here|when|where|what|how|who|why|can|get|need|want|please)\b/i,
];

const EN_LEAD_PATTERNS = [
  /^\s*(how to|how do i|what is|where can i|can i|i need|please)\b/i,
];

function detectByHeuristics(text: string): LanguageDetection {
  const t = text.trim();
  if (!t) {
    return { language: 'hr', confidence: 0.5, isMixed: false, iso3: 'und', source: 'heuristic' };
  }

  let hrScore = 0;
  let enScore = 0;

  for (const pattern of HR_STRONG) {
    hrScore += (t.match(new RegExp(pattern.source, 'gi')) ?? []).length * 3;
  }

  for (const pattern of HR_MODERATE) {
    hrScore += (t.match(new RegExp(pattern.source, 'gi')) ?? []).length;
  }

  // Give extra weight to common inflected civic nouns (e.g. "osobnu karticu").
  for (const pattern of HR_CIVIC_INFLECTED) {
    hrScore += (t.match(new RegExp(pattern.source, 'gi')) ?? []).length * 2;
  }

  for (const pattern of EN_STRONG) {
    enScore += (t.match(new RegExp(pattern.source, 'gi')) ?? []).length * 2;
  }

  const total = hrScore + enScore;
  if (total === 0) {
    return { language: 'hr', confidence: 0.5, isMixed: false, iso3: 'und', source: 'heuristic' };
  }

  const hrRatio = hrScore / total;
  const isMixed = hrRatio > 0.35 && hrRatio < 0.65;
  const language: ChatLanguage = hrRatio >= 0.5 ? 'hr' : 'en';
  const confidence = isMixed
    ? 0.5
    : language === 'hr'
      ? Math.min(0.5 + hrRatio * 0.6, 0.95)
      : Math.min(0.5 + (1 - hrRatio) * 0.6, 0.95);

  return { language, confidence, isMixed, iso3: language === 'hr' ? 'hrv' : 'eng', source: 'heuristic' };
}

function detectIso3(text: string, minLength: number): string {
  const value = text.trim();
  if (!value) return 'und';
  return franc(value, { minLength });
}

function hasCroatianSignals(text: string): boolean {
  return [...HR_STRONG, ...HR_MODERATE, ...HR_CIVIC_INFLECTED].some((pattern) => pattern.test(text));
}

function hasEnglishSignals(text: string): boolean {
  return EN_STRONG.some((pattern) => pattern.test(text));
}

function hasEnglishLead(text: string): boolean {
  return EN_LEAD_PATTERNS.some((pattern) => pattern.test(text));
}

function toChatLanguage(value: unknown): ChatLanguage | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'en' || normalized === 'eng') return 'en';
  if (normalized === 'hr' || normalized === 'hrv' || normalized === 'bos' || normalized === 'srp') return 'hr';
  return null;
}

function clampConfidence(value: unknown, fallback = 0.75): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

async function resolveLowConfidenceWithClaude(text: string): Promise<{
  language: ChatLanguage;
  normalizedText: string;
  confidence: number;
} | null> {
  const endpoint = import.meta.env.VITE_LANGUAGE_RESOLVER_URL as string | undefined;
  if (!endpoint) return null;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const language = toChatLanguage(data?.dominant ?? data?.language ?? data?.lang);
    if (!language) return null;

    const normalizedText = typeof data?.normalized === 'string'
      ? data.normalized
      : typeof data?.normalizedText === 'string'
        ? data.normalizedText
        : text;

    return {
      language,
      normalizedText,
      confidence: clampConfidence(data?.confidence, 0.8),
    };
  } catch {
    return null;
  }
}

function isMixedLanguage(text: string, dominantIso3: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;

  const mid = Math.floor(words.length / 2);
  const half1 = words.slice(0, mid).join(' ');
  const half2 = words.slice(mid).join(' ');

  const lang1 = detectIso3(half1, 3);
  const lang2 = detectIso3(half2, 3);
  if (lang1 !== 'und' && lang2 !== 'und' && lang1 !== lang2) {
    return true;
  }

  if (SLAVIC_ISO3.has(dominantIso3)) {
    return hasEnglishSignals(text);
  }

  if (dominantIso3 === 'eng') {
    return hasCroatianSignals(text);
  }

  return hasCroatianSignals(text) && hasEnglishSignals(text);
}

export function detectLanguage(text: string): LanguageDetection {
  const t = text.trim();
  if (!t) {
    return { language: 'hr', confidence: 0.5, isMixed: false, iso3: 'und', source: 'heuristic' };
  }

  const heuristic = detectByHeuristics(t);
  const englishLead = hasEnglishLead(t);
  const croatianSignals = hasCroatianSignals(t);
  const englishSignals = hasEnglishSignals(t);

  if (englishLead && croatianSignals && englishSignals) {
    return { language: 'en', confidence: 0.74, isMixed: true, iso3: 'eng', source: 'heuristic' };
  }

  const iso3 = detectIso3(t, 10);
  const mappedLanguage = ISO3_TO_CHAT_LANGUAGE[iso3];

  if (!mappedLanguage || LOW_CONFIDENCE_LANGS.has(iso3)) {
    return heuristic;
  }

  const isMixed = isMixedLanguage(t, iso3) || heuristic.isMixed;
  const confidence = isMixed ? 0.5 : 0.85;
  return { language: mappedLanguage, confidence, isMixed, iso3, source: 'franc' };
}

export function normaliseMixedQuery(text: string, detectedLanguage: ChatLanguage): string {
  const { isMixed } = detectLanguage(text);
  if (!isMixed) return text;

  let normalised = text;

  if (detectedLanguage === 'hr') {
    normalised = normalised.replace(
      /\bI need (?:a |an |my )?(putovnica|osobna|domovnica|rodni list|vozačka|vozacka)\b/gi,
      (_match, doc: string) => `Trebam ${doc}`,
    );

    normalised = normalised.replace(
      /\bhow do I (platiti|zakazati|prijaviti|dobiti)\b/gi,
      (_match, verb: string) => `Kako ${verb}`,
    );

    normalised = normalised.replace(/\bhow to get\b/gi, 'Kako dobiti');

    const replacements: Array<[RegExp, string]> = [
      [/\bosobn(?:u|a|e)?\s+kartic(?:u|a|e)\b/gi, 'osobnu iskaznicu'],
      [/\bbuilding permit\b/gi, 'građevinsku dozvolu'],
      [/\btrade licen[cs]e\b/gi, 'obrtnu dozvolu'],
      [/\bdriving licen[cs]e\b/gi, 'vozačku dozvolu'],
      [/\bpassport\b/gi, 'putovnicu'],
      [/\bid card\b/gi, 'osobnu iskaznicu'],
      [/\bbirth certificate\b/gi, 'rodni list'],
      [/\bworking hours\b/gi, 'radno vrijeme'],
    ];

    for (const [pattern, replacement] of replacements) {
      normalised = normalised.replace(pattern, replacement);
    }

    return normalised;
  }

  const replacements: Array<[RegExp, string]> = [
    [/\bkako dobiti\b/gi, 'how to get'],
    [/\btrebam\b/gi, 'I need'],
    [/\bosobn(?:u|a|e|oj|om)?\s+(?:iskaznic(?:u|a|e|i|om)|kartic(?:u|a|e|i|om))\b/gi, 'ID card'],
    [/\bputovnic(?:u|a|e|i|om)?\b/gi, 'passport'],
    [/\bdomovnic(?:u|a|e|i|om)?\b/gi, 'citizenship certificate'],
    [/\brodni list\b/gi, 'birth certificate'],
    [/\bradno vrijeme\b/gi, 'working hours'],
    [/\bgrađevinsk\w*\s+dozvol\w*\b/gi, 'building permit'],
    [/\bvozačk\w*\s+dozvol\w*\b/gi, 'driving licence'],
    [/\bobrtn\w*\s+dozvol\w*\b/gi, 'trade licence'],
  ];

  for (const [pattern, replacement] of replacements) {
    normalised = normalised.replace(pattern, replacement);
  }

  return normalised;
}

export async function prepareLanguageQuery(
  text: string,
  preferredLanguage: ChatLanguage | null = null,
): Promise<PreparedLanguageQuery> {
  let detection = detectLanguage(text);
  let language = preferredLanguage ?? detection.language;
  let normalizedText = normaliseMixedQuery(text, language);

  if (!preferredLanguage && detection.confidence < 0.65) {
    const claudeResolution = await resolveLowConfidenceWithClaude(text);
    if (claudeResolution) {
      language = claudeResolution.language;
      normalizedText = claudeResolution.normalizedText || normaliseMixedQuery(text, language);
      detection = {
        language,
        confidence: Math.max(detection.confidence, claudeResolution.confidence),
        isMixed: detection.isMixed || normalizedText !== text,
        iso3: language === 'en' ? 'eng' : 'hrv',
        source: 'claude-fallback',
      };
    }
  }

  return {
    ...detection,
    language,
    originalText: text,
    normalizedText,
    changed: normalizedText !== text,
  };
}
