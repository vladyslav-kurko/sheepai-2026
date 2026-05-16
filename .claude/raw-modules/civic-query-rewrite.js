/**
 * civic-query-rewrite.js
 *
 * Query rewriting layer — sits between raw user text and web search.
 *
 * Four responsibilities:
 *   1. normaliseForSearch()    — strip conversational noise, fix diacritics
 *   2. mapToOfficialTerms()   — colloquial → official administrative terms
 *   3. scopeToCity()          — append city + official domain hints
 *   4. decomposeMultiIntent() — split compound requests into separate queries
 *
 * Also provides:
 *   5. rewriteQuery()         — full pipeline: normalise → map → scope → return
 *   6. rewriteWithClaude()    — Claude-powered rewrite for low-confidence cases
 *   7. rewriteForDiscovery()  — drop-in integration with civic-url-discovery.js
 */

// ─── 1. NORMALISE FOR SEARCH ──────────────────────────────────────────────────

/**
 * Strips conversational filler, punctuation, and question framing
 * that hurt search relevance. Fixes missing diacritics.
 *
 * "Hej, kako bih mogao dobiti osobnu??"  →  "dobiti osobnu"
 * "I'd like to get a building permit please"  →  "building permit"
 */

const FILLER_HR = [
  /^(hej|bok|zdravo|ćao|cao|pozdrav|molim te|molim vas|možete li mi|biste li mi|htio bih|htjela bih|zanima me|imam pitanje|pitanje)[,!.:\s]*/i,
  /\b(hvala|unaprijed|lijep pozdrav|puno hvala|molim|vas|te)\s*[.!?]*$/i,
  /\b(kako bih mogao|kako bih mogla|kako mogu|gdje mogu|što trebam|trebam li|da li|je li|može li se|moguće je|može li|moze li)\b/gi,
  /\b(nekako|zapravo|uglavnom|znači|dakle|inače|praktički|otprilike|samo)\b/gi,
];

const FILLER_EN = [
  /^(hey|hi|hello|excuse me|sorry|please|could you|can you|would you|i'd like to|i want to|i need to|how do i|how can i|where do i|where can i|what do i need|help me|tell me)[,!.:\s]*/i,
  /\b(please|thanks|thank you|cheers|appreciate it|in advance)\s*[.!?]*$/i,
  /\b(just|really|actually|basically|literally|probably|maybe|perhaps|kind of|sort of|i guess)\b/gi,
];

/**
 * Missing-diacritics map.
 * Only applied when language=hr — safe because these words are
 * unambiguously Croatian even without diacritics.
 */
const DIACRITICS_FIX = {
  "gradjevinska":  "građevinska",  "gradevinska":   "građevinska",
  "gradjevinsku":  "građevinsku",  "gradevinska":   "građevinska",
  "zupanija":      "županija",     "zupanije":      "županije",
  "zupaniju":      "županiju",
  "vozacka":       "vozačka",      "vozacku":       "vozačku",
  "maticni":       "matični",      "maticara":      "matičara",
  "maticar":       "matičar",      "maticnog":      "matičnog",
  "prituzba":      "pritužba",     "prituzbu":      "pritužbu",
  "sluzbeni":      "službeni",     "sluzbenu":      "službenu",
  "opcina":        "općina",       "opcine":        "općine",
  "opcinu":        "općinu",       "opcinski":      "općinski",
  "porezna":       "porezna",      "poreznu":       "poreznu",
  "cekanje":       "čekanje",      "cekaonica":     "čekaonica",
  "skola":         "škola",        "skolski":       "školski",
  "sjediste":      "sjedište",
};

export function normaliseForSearch(text, language = "hr") {
  let q = text.trim();

  // Strip trailing punctuation noise
  q = q.replace(/[?!.…]+$/g, "").trim();

  // Strip filler phrases
  const fillers = language === "hr" ? FILLER_HR : FILLER_EN;
  for (const pat of fillers) {
    q = q.replace(pat, " ");
  }

  // Fix missing diacritics (Croatian only)
  if (language === "hr") {
    q = q.replace(/\b[a-zA-Z]+\b/g, w => {
      const lower = w.toLowerCase();
      return DIACRITICS_FIX[lower] ?? w;
    });
  }

  return q.replace(/\s+/g, " ").trim();
}


// ─── 2. COLLOQUIAL → OFFICIAL TERM MAPPING ───────────────────────────────────

/**
 * Two-step mapping:
 *   a) Exact phrase replacements (long patterns first to avoid partial matches)
 *   b) Short-form expansions ("osobna" → "osobna iskaznica" only when
 *      not already followed by the full term)
 */

const TERM_MAP_HR = [
  // ── Documents (long patterns first) ──
  [/\bvozačk[aue]\s+dozvol[aue]?\b/gi,    m => m],  // already full — pass through
  [/\bosobna\s+iskaznic[aue]?\b/gi,        m => m],
  [/\brodni\s+list\b/gi,                    m => m],
  [/\bvjenčani\s+list\b/gi,                 m => m],

  // Short forms expand to full
  [/\bosobn[aue]\b(?!\s+iskaznic)/gi,       "osobna iskaznica"],
  [/\biskaznic[aue]\b/gi,                   "osobna iskaznica"],
  [/\bputovnic[aue]?\b/gi,                  "putovnica"],
  [/\bpasoš[a]?\b/gi,                       "putovnica"],
  [/\brodni\b(?!\s+list)/gi,                "rodni list"],
  [/\bdomovnic[aue]?\b/gi,                  "domovnica"],
  [/\bvozačk[aue]\b(?!\s+dozvol)/gi,        "vozačka dozvola"],
  [/\bvjenčani\b(?!\s+list)/gi,             "vjenčani list"],

  // ── Permits ──
  [/\bgrađevinsk[aue]\b(?!\s+dozvol)/gi,    "građevinska dozvola"],
  [/\bobrt[a]?\b(?!\s*(nic|registar))/gi,   "osnivanje obrta"],
  [/\bnatpis[a]?\b/gi,                       "dozvola za natpis"],
  [/\bteras[aue]?\b/gi,                      "dozvola za terasu"],

  // ── Payments ──
  [/\bkomunaln[aue]\b(?!\s+naknada)/gi,     "komunalna naknada"],
  [/\bporez\b(?!\s+na)/gi,                   "porez na nekretnine"],
  [/\bkazn[aue]\b/gi,                        "kazna prekršaj"],
  [/\bparking\b/gi,                           "kazna za parkiranje"],
  [/\brežij[ae]\b/gi,                         "komunalne usluge"],

  // ── Appointments ──
  [/\bmatičar[a]?\b/gi,                      "matični ured"],
  [/\bšalter[a]?\b/gi,                       "šalter gradskog ureda"],

  // ── Complaints ──
  [/\brup[ae]\b(?!\s+na\s+cesti)/gi,         "oštećenje kolnika prijava"],
  [/\bbuk[ae]\b/gi,                           "prijava buke komunalni redar"],
  [/\bsmrad\b/gi,                             "prijava neugodnog mirisa"],
  [/\bdivlj[ae]\s*odlaganj[ae]?\b/gi,        "divlje odlaganje otpada prijava"],
  [/\bnepropisno\s*parkiran[jae]+\b/gi,      "nepropisno parkiranje prijava"],
];

const TERM_MAP_EN = [
  // Maps English civic terms to bilingual queries (EN + HR) for better coverage
  [/\bid card\b/gi,                   "osobna iskaznica ID card"],
  [/\bpassport\b/gi,                  "putovnica passport"],
  [/\bbirth certificate\b/gi,         "rodni list birth certificate"],
  [/\bdeath certificate\b/gi,         "smrtni list death certificate"],
  [/\bmarriage certificate\b/gi,      "vjenčani list marriage certificate"],
  [/\bdriving licen[cs]e\b/gi,        "vozačka dozvola driving licence"],
  [/\bbuilding permit\b/gi,           "građevinska dozvola building permit"],
  [/\btrade licen[cs]e\b/gi,          "obrt trade licence"],
  [/\bcommunal fee\b/gi,              "komunalna naknada communal fee"],
  [/\bproperty tax\b/gi,              "porez na nekretnine property tax"],
  [/\bparking fine\b/gi,              "kazna za parkiranje parking fine"],
  [/\bpothole\b/gi,                   "oštećenje kolnika pothole"],
  [/\bnoise complaint\b/gi,           "prijava buke noise complaint"],
  [/\bcivil registry\b/gi,            "matični ured civil registry"],
  [/\bcitizenship\b/gi,               "domovnica citizenship certificate"],
  [/\bresidence permit\b/gi,          "boravišna dozvola residence permit"],
];

export function mapToOfficialTerms(text, language = "hr") {
  let q = text;
  const map = language === "hr" ? TERM_MAP_HR : TERM_MAP_EN;

  for (const [pattern, replacement] of map) {
    if (typeof replacement === "function") {
      q = q.replace(pattern, replacement);
    } else {
      q = q.replace(pattern, replacement);
    }
  }

  return q.replace(/\s+/g, " ").trim();
}


// ─── 3. CITY-SCOPED SEARCH QUERY BUILDER ─────────────────────────────────────

const INTENT_DOMAIN = {
  document:    "site:mup.gov.hr OR site:gov.hr",
  permit:      "site:gov.hr",
  payment:     "site:gov.hr",
  appointment: "site:gov.hr",
  complaint:   "",   // complaints often on city portals only
  info:        "site:gov.hr",
};

const CITY_DOMAIN = {
  zagreb:    "site:zagreb.hr",     split:     "site:split.hr",
  rijeka:    "site:rijeka.hr",     osijek:    "site:osijek.hr",
  zadar:     "site:zadar.hr",      dubrovnik: "site:dubrovnik.hr",
  pula:      "site:pula.hr",       karlovac:  "site:karlovac.hr",
  "varaždin":"site:varazdin.hr",   varazdin:  "site:varazdin.hr",
  sisak:     "site:sisak.hr",      "slavonski brod": "site:slavonski-brod.hr",
};

export function scopeToCity(query, city, intent) {
  const parts = [query];

  // Add city name if not already present
  const cityLower = (city ?? "").toLowerCase().trim();
  if (cityLower && !query.toLowerCase().includes(cityLower)) {
    parts.push(city);
  }

  // Build domain scope: city domain OR intent domain
  const cityDom   = CITY_DOMAIN[cityLower] ?? "";
  const intentDom = INTENT_DOMAIN[intent]  ?? "";

  if (cityDom && intentDom) {
    parts.push(`${cityDom} OR ${intentDom}`);
  } else if (cityDom) {
    parts.push(cityDom);
  } else if (intentDom) {
    parts.push(intentDom);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}


// ─── 4. MULTI-INTENT DECOMPOSITION ──────────────────────────────────────────

/**
 * Detects compound requests and splits them into independent sub-queries.
 *
 * "Trebam osobnu i rodni list"  →  2 queries
 * "Get a passport and pay the communal fee"  →  2 queries
 * "Trebam veliku i lijepu kuću"  →  NOT split (no civic topic in both halves)
 */

const SPLIT_HR = /\b(i|te|kao\s+i|a\s+(?:i|takodjer|također|isto\s+tako))\b/i;
const SPLIT_EN = /\b(and|also|as\s+well\s+as|plus|and\s+also)\b/i;

const TOPIC_MARKER = /\b(osobna|iskaznica|putovnica|rodni|domovnica|vozačka|dozvola|obrt|naknada|naknadu|porez|termin|prijava|pritužba|matičar|certificate|passport|permit|licence|license|appointment|payment|complaint|fee|tax|id\s+card|birth|driving|communal|pothole|noise)\b/i;

export function decomposeMultiIntent(text, language = "hr") {
  const splitter = language === "hr" ? SPLIT_HR : SPLIT_EN;

  if (!splitter.test(text)) {
    return [{ text, isDecomposed: false }];
  }

  // Split on conjunction, keep only substantial parts
  const parts = text
    .split(splitter)
    .map(p => p.trim())
    .filter(p => p.length > 3 && !splitter.test(p)); // drop the conjunction itself

  // Both halves must contain a civic topic marker — otherwise it's a natural conjunction
  const topicParts = parts.filter(p => TOPIC_MARKER.test(p));

  if (topicParts.length < 2) {
    return [{ text, isDecomposed: false }];
  }

  return topicParts.map(p => ({ text: p, isDecomposed: true }));
}


// ─── 5. FULL PIPELINE ─────────────────────────────────────────────────────────

/**
 * rewriteQuery — runs all four stages in order.
 * Returns string[] — one per sub-query (usually 1, up to 3 for compound).
 *
 * @param {string} rawText       — user text (already language-normalised)
 * @param {object} intentResult  — from detectCivicIntent / resolveIntent
 * @param {object} opts
 * @param {boolean} opts.decompose — split multi-intent? default true
 * @returns {string[]}
 */
export function rewriteQuery(rawText, intentResult, opts = {}) {
  const { decompose = true } = opts;
  const lang   = intentResult?.language ?? "hr";
  const city   = intentResult?.city     ?? null;
  const intent = intentResult?.intent   ?? "info";

  // Step 1: decompose compound
  const chunks = decompose
    ? decomposeMultiIntent(rawText, lang)
    : [{ text: rawText, isDecomposed: false }];

  // Steps 2–4 per chunk
  return chunks.map(({ text: sub }) => {
    let q = normaliseForSearch(sub, lang);
    q = mapToOfficialTerms(q, lang);
    q = scopeToCity(q, city, intent);
    return q;
  });
}


// ─── 6. CLAUDE-POWERED REWRITE ───────────────────────────────────────────────

export async function rewriteWithClaude(rawText, intentResult) {
  const lang   = intentResult?.language ?? "hr";
  const city   = intentResult?.city     ?? "Zagreb";
  const intent = intentResult?.intent   ?? "info";

  const [primary] = rewriteQuery(rawText, intentResult, { decompose: false });

  const prompt = `You generate search engine queries for a Croatian civic assistant.

User said: "${rawText}"
Detected intent: ${intent}
City: ${city}
Language: ${lang}
Rule-based rewrite: "${primary}"

Generate exactly 3 search queries, best-first.
Query 1 = the rule-based result above verbatim.
Queries 2–3 = creative variations using different official terminology, department names, or phrasing.

Rules:
- Croatian administrative language
- No quotes inside queries
- Include city name in every query
- Prefer .gov.hr and city portal domains
- Return ONLY a JSON array of 3 strings`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        system: "Return only valid JSON arrays of strings. No prose.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data  = await res.json();
    const raw   = data.content?.[0]?.text ?? "[]";
    const match = raw.replace(/```json|```/g, "").match(/\[[\s\S]*\]/);
    if (match) {
      const arr = JSON.parse(match[0]);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch (_) {}

  return [primary];
}


// ─── 7. DROP-IN INTEGRATION ──────────────────────────────────────────────────

/**
 * rewriteForDiscovery — main entry point called by discoverUrl().
 *
 * Replaces the old rewriteQueryLocal / rewriteQueryWithClaude pair
 * in civic-url-discovery.js. Pass the user's raw normalised text
 * and the intentResult.
 *
 * Returns string[] of search queries ready for the web_search tool.
 */
export async function rewriteForDiscovery(rawText, intentResult) {
  const confidence = intentResult?.confidence ?? 0;

  // Rule-based rewrite is sufficient for confident intents
  if (confidence >= 0.6) {
    return rewriteQuery(rawText, intentResult);
  }

  // Low confidence → let Claude produce creative variations
  return rewriteWithClaude(rawText, intentResult);
}