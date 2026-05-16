/**
 * civic-url-discovery.js
 *
 * Autonomous URL discovery — the layer between intent detection and extractPageData.
 * The user never provides a URL. This module finds it.
 *
 * Pipeline:
 *   1. Query rewriter    — turns raw user query into a good search string
 *   2. Web search        — uses Claude's web_search tool via the API
 *   3. URL scorer        — ranks results by how official/relevant they are
 *   4. Fallback catalog  — known good URLs for common Croatian services
 *   5. Returns best URL  → passed directly into extractPageData()
 */

// ─── 1. KNOWN-GOOD URL CATALOG ───────────────────────────────────────────────
//
// For the most common civic queries, skip search entirely.
// These are pre-verified, stable official pages.
// Keyed by: `${intent}:${city}` or `${intent}:national`

const KNOWN_URLS = {
  // National / MUP
  "document:national:osobna":      "https://mup.gov.hr/gradjani/osobne-isprave/osobna-iskaznica/233",
  "document:national:putovnica":   "https://mup.gov.hr/gradjani/osobne-isprave/putovnica/232",
  "document:national:vozacka":     "https://mup.gov.hr/gradjani/promet/vozacka-dozvola/230",

  // Zagreb city portal
  "permit:zagreb:gradevinska":     "https://www.zagreb.hr/gradjevinska-dozvola/2276",
  "permit:zagreb:obrt":            "https://obrtnicki-registar.gov.hr/",
  "payment:zagreb:komunalna":      "https://www.zagreb.hr/komunalna-naknada/2282",
  "document:zagreb:rodni-list":    "https://www.zagreb.hr/rodni-list/2278",
  "document:zagreb:domovnica":     "https://www.zagreb.hr/domovnica/2279",
  "appointment:zagreb:maticari":   "https://www.zagreb.hr/maticari/2280",

  // e-Građani (national e-government portal)
  "general:national:egradjani":    "https://gov.hr/",
};

// Official Croatian government domains — highest trust
const OFFICIAL_DOMAINS = new Set([
  "gov.hr", "mup.gov.hr", "mfin.gov.hr", "mint.gov.hr", "mrms.gov.hr",
  "zagreb.hr", "split.hr", "rijeka.hr", "osijek.hr", "zadar.hr",
  "dubrovnik.hr", "pula.hr", "sisak.hr", "karlovac.hr", "varazdin.hr",
  "obrtnicki-registar.gov.hr", "e-uprava.gov.hr", "porezna-uprava.gov.hr",
  "hzmo.hr", "hzzo.hr", "hzz.hr", "pravosudje.hr",
]);

// Domains to penalise — noise / commentary / SEO farms
const NOISE_DOMAINS = new Set([
  "reddit.com", "forum.hr", "njuskalo.hr", "facebook.com", "instagram.com",
  "index.hr", "jutarnji.hr", "vecernji.hr", "24sata.hr", "net.hr",
  "poslovni.hr", "bug.hr", "mojposao.net", "racunovodstvo.hr",
]);


// ─── 2. QUERY REWRITER ───────────────────────────────────────────────────────
//
// Maps colloquial user language → clean search queries.
// Two strategies: rule-based table (fast) + Claude rewrite (thorough).

const QUERY_RULES = {
  // Colloquial HR → official term + site scope
  "osobna":             "osobna iskaznica",
  "osobnu":             "osobna iskaznica",
  "osobne":             "osobna iskaznica",
  "iskaznica":          "osobna iskaznica",
  "putovnica":          "putovnica",
  "pasoš":              "putovnica",
  "rodni list":         "rodni list izvadak",
  "rodni":              "rodni list",
  "domovnica":          "domovnica potvrda",
  "vozačka":            "vozačka dozvola",
  "vozacka":            "vozačka dozvola",
  "dozvola":            "dozvola",
  "građevinska":        "građevinska dozvola",
  "gradjevinska":       "građevinska dozvola",
  "komunalna":          "komunalna naknada plaćanje",
  "komunalnu":          "komunalna naknada",
  "porez":              "porezna uprava",
  "obrt":               "obrtni registar osnivanje obrta",
  "rupa":               "prijava oštećenja kolnika",
  "buka":               "prijava buke komunalni redar",
  "termin":             "zakazivanje termina",
  "vjenčanje":          "matičar vjenčanje zakazivanje",
  "krštenje":           "matičar krštenje",
};

const INTENT_SITE_HINTS = {
  document:    "site:gov.hr OR site:zagreb.hr OR site:mup.gov.hr",
  permit:      "site:gov.hr OR site:zagreb.hr",
  payment:     "site:zagreb.hr OR site:gov.hr naknada plaćanje",
  appointment: "zakazivanje termin site:zagreb.hr OR site:gov.hr",
  complaint:   "prijava komunalni redar site:zagreb.hr",
  info:        "site:gov.hr OR site:zagreb.hr",
};

/**
 * Rule-based query rewrite — zero latency.
 * Returns a search query string ready for the web_search tool.
 */
export function rewriteQueryLocal(intentResult) {
  const { intent, slots, city, language } = intentResult;

  // Start from slot values (most specific)
  const docType    = slots?.document_type ?? slots?.permit_type ?? slots?.complaint_type ?? null;
  const rawQuery   = slots?.topic ?? null;
  const cityStr    = city ?? "Zagreb";

  let terms = [];

  // Apply rule mapping
  if (docType) {
    const mapped = QUERY_RULES[docType.toLowerCase()] ?? docType;
    terms.push(mapped);
  } else if (rawQuery) {
    // Tokenise and map individual words
    const words = rawQuery.toLowerCase().split(/\s+/);
    const mapped = words.map(w => QUERY_RULES[w] ?? w).join(" ");
    terms.push(mapped);
  }

  // Always add city
  terms.push(cityStr);

  // Add site scope hint based on intent
  const siteHint = INTENT_SITE_HINTS[intent] ?? "";

  const query = `${terms.join(" ")} ${siteHint}`.trim();
  return query;
}

/**
 * Claude-powered query rewrite — richer but costs one API call.
 * Use when local rewrite confidence is low.
 */
export async function rewriteQueryWithClaude(intentResult) {
  const { intent, slots, city, language } = intentResult;

  const prompt = `You generate search engine queries for a Croatian civic assistant.

User intent: ${intent}
Detected slots: ${JSON.stringify(slots, null, 2)}
City: ${city ?? "Zagreb"}
Language the user wrote in: ${language ?? "hr"}

Generate exactly 3 search queries, ordered best-first, to find the OFFICIAL Croatian government page
that answers this civic need. Prefer .gov.hr and city portal domains.

Rules:
- Each query must be in Croatian (use official terminology, not colloquial)
- Append the city name to narrow results
- Do NOT use quotes in the query
- Return only a JSON array of 3 strings, no prose

Example output: ["osobna iskaznica Zagreb MUP", "vađenje osobne iskaznice Zagreb", "MUP osobna iskaznica zahtjev Zagreb"]`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: "You are a search query generator. Return only valid JSON arrays of strings.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data   = await response.json();
  const raw    = data.content?.[0]?.text ?? "[]";
  const clean  = raw.replace(/```json|```/g, "").trim();

  try {
    const queries = JSON.parse(clean);
    return Array.isArray(queries) ? queries : [rewriteQueryLocal(intentResult)];
  } catch {
    return [rewriteQueryLocal(intentResult)];
  }
}


// ─── 3. URL SCORER ───────────────────────────────────────────────────────────
//
// Scores each search result URL on trustworthiness and relevance.
// Higher score = more likely to be the right official page.

export function scoreSearchResult(result, intentResult) {
  const url     = (result.url ?? result.href ?? "").toLowerCase();
  const title   = (result.title ?? "").toLowerCase();
  const snippet = (result.snippet ?? result.description ?? "").toLowerCase();

  let score = 0;

  // ── Domain trust ──────────────────────────────────────────────────────────
  try {
    const domain = new URL(url.startsWith("http") ? url : "https://" + url).hostname;
    const baseDomain = domain.replace(/^www\./, "");

    if (OFFICIAL_DOMAINS.has(baseDomain))    score += 4;
    else if (baseDomain.endsWith(".gov.hr")) score += 4;
    else if (baseDomain.endsWith(".hr"))     score += 2;

    if (NOISE_DOMAINS.has(baseDomain))       score -= 4;
    if (domain.includes("blog"))             score -= 2;
    if (domain.includes("forum"))            score -= 3;
  } catch (_) {}

  // ── URL path signals ──────────────────────────────────────────────────────
  const intentSlugMap = {
    document:    ["isprava", "iskaznica", "putovnica", "rodni", "domovnica", "vozacka"],
    permit:      ["dozvola", "odobrenje", "gradnja", "obrt", "registracija"],
    payment:     ["naknada", "placanje", "porez", "racun"],
    appointment: ["termin", "zakazivanje", "maticari"],
    complaint:   ["prijava", "komunalni", "kvar"],
    info:        [],
  };

  const intentSlugs = intentSlugMap[intentResult?.intent] ?? [];
  if (intentSlugs.some(slug => url.includes(slug))) score += 2;

  // Penalise direct PDF links (we want the page, not the PDF)
  if (url.endsWith(".pdf"))  score -= 2;
  if (url.endsWith(".docx")) score -= 2;

  // ── Content signals in title / snippet ────────────────────────────────────
  const { slots, city } = intentResult ?? {};
  const docType = (slots?.document_type ?? slots?.permit_type ?? "").toLowerCase();
  const cityStr = (city ?? "zagreb").toLowerCase();

  if (title.includes(cityStr) || snippet.includes(cityStr))   score += 1;
  if (docType && (title.includes(docType) || snippet.includes(docType))) score += 2;

  // Useful content signals
  if (/\d{1,2}:\d{2}/.test(snippet))                          score += 1; // hours pattern
  if (/\d+\s*(kn|€|eur)/i.test(snippet))                      score += 1; // price pattern
  if (/adresa|ulica|ul\./i.test(snippet))                      score += 1; // address signal

  // News / media pattern in URL
  if (/\/\d{4}\/\d{2}\/\d{2}\//.test(url))                    score -= 3; // date slug = news
  if (/clanak|vijest|novost|news/i.test(url))                  score -= 2;

  return score;
}


// ─── 4. WEB SEARCH VIA CLAUDE API ───────────────────────────────────────────
//
// Uses the Claude web_search tool to get live results.
// Returns an array of { url, title, snippet } objects.

export async function searchForPage(queries) {
  // Run up to 2 queries, use the one with best-scored results
  const allResults = [];

  for (const query of queries.slice(0, 2)) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        tool_choice: { type: "any" },
        system: `You search for Croatian government pages. 
When you get search results, return ONLY a JSON array of the top 5 results.
Each item: { "url": string, "title": string, "snippet": string }
No prose. No markdown.`,
        messages: [{
          role: "user",
          content: `Search for: ${query}\n\nReturn the top 5 results as JSON array.`,
        }],
      }),
    });

    const data = await response.json();

    // Extract the text content from the response (may include tool_use blocks)
    const textBlocks = (data.content ?? [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    try {
      const clean = textBlocks.replace(/```json|```/g, "").trim();
      const match = clean.match(/\[[\s\S]*\]/);
      if (match) {
        const results = JSON.parse(match[0]);
        allResults.push(...results);
      }
    } catch (_) {
      // Parse failure — continue to next query
    }
  }

  return allResults;
}


// ─── 5. CATALOG LOOKUP ───────────────────────────────────────────────────────
//
// Before searching, check if we already know the right URL for this exact need.

export function lookupCatalog(intentResult) {
  const { intent, slots, city } = intentResult ?? {};
  const cityKey = (city ?? "").toLowerCase().replace(/\s+/g, "-");

  // Build lookup keys from most specific to least specific
  const docType    = (slots?.document_type ?? slots?.permit_type ?? "")
    .toLowerCase().replace(/\s+/g, "-");

  const candidates = [
    `${intent}:${cityKey}:${docType}`,
    `${intent}:national:${docType}`,
    `${intent}:${cityKey}`,
  ];

  for (const key of candidates) {
    if (KNOWN_URLS[key]) return KNOWN_URLS[key];
  }
  return null;
}


// ─── 6. MAIN ORCHESTRATOR ────────────────────────────────────────────────────
//
// Single entry point. Returns { url, title, allCandidates, source }.
//
// Usage:
//   const { url } = await discoverUrl(intentResult);
//   const pageData = await extractPageData({ html: await fetch(url).text(), sourceUrl: url, intentResult });

export async function discoverUrl(intentResult, options = {}) {
  const { skipCatalog = false, skipSearch = false } = options;

  // ── Step 1: Catalog fast-path ─────────────────────────────────────────────
  if (!skipCatalog) {
    const catalogUrl = lookupCatalog(intentResult);
    if (catalogUrl) {
      return {
        url:           catalogUrl,
        title:         null,
        snippet:       null,
        score:         10,
        source:        "catalog",
        allCandidates: [{ url: catalogUrl, score: 10, source: "catalog" }],
      };
    }
  }

  if (skipSearch) {
    return { url: null, source: "none", allCandidates: [] };
  }

  // ── Step 2: Rewrite query ─────────────────────────────────────────────────
  // Local rewrite is fast; use Claude rewrite for low-confidence intents
  const useClaudeRewrite = intentResult.confidence < 0.65;
  const queries = useClaudeRewrite
    ? await rewriteQueryWithClaude(intentResult)
    : [rewriteQueryLocal(intentResult)];

  // ── Step 3: Web search ────────────────────────────────────────────────────
  const rawResults = await searchForPage(queries);

  if (!rawResults.length) {
    return { url: null, source: "search-empty", allCandidates: [] };
  }

  // ── Step 4: Score and rank ────────────────────────────────────────────────
  const scored = rawResults
    .map(r => ({ ...r, score: scoreSearchResult(r, intentResult) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  // If best score is too low, nothing looks trustworthy — signal caller
  if (best.score < 1) {
    return {
      url:           null,
      source:        "low-confidence",
      allCandidates: scored,
      warning:       "No official-looking results found. Consider asking user for their city.",
    };
  }

  return {
    url:           best.url,
    title:         best.title,
    snippet:       best.snippet,
    score:         best.score,
    source:        "search",
    allCandidates: scored,
  };
}


// ─── 7. HTML FETCHER ─────────────────────────────────────────────────────────
//
// Fetches HTML from the discovered URL.
// In a browser context this must go through a CORS proxy — government sites
// don't set permissive CORS headers. In Node/server context, fetch directly.

const CORS_PROXY = "https://api.allorigins.win/raw?url=";  // replace with your own proxy

export async function fetchPageHtml(url, { useProxy = true } = {}) {
  const fetchUrl = useProxy ? `${CORS_PROXY}${encodeURIComponent(url)}` : url;

  const response = await fetch(fetchUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CivicAssistant/1.0)",
      "Accept":     "text/html,application/xhtml+xml",
      "Accept-Language": "hr,en;q=0.9",
    },
    signal: AbortSignal.timeout(8000),  // 8 second timeout
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return response.text();
}


// ─── 8. END-TO-END PIPELINE ──────────────────────────────────────────────────
//
// This is what the chat UI actually calls.
// Input: intentResult from civic-intent-detection.js
// Output: PageData ready for all output modules
//
// Usage:
//   import { runDiscoveryAndExtraction } from "./civic-url-discovery.js";
//   import { detectCivicIntent }         from "./civic-intent-detection.js";
//   import { extractPageData }           from "./civic-extraction.js";
//
//   const intentResult = await detectCivicIntent(userMessage);
//   const pageData     = await runDiscoveryAndExtraction(intentResult);
//   // render pageData with ExtractionPreview

export async function runDiscoveryAndExtraction(intentResult, extractFn) {
  // 1. Find URL
  const discovery = await discoverUrl(intentResult);

  if (!discovery.url) {
    return {
      _error: discovery.warning ?? "Could not find an official page for this query.",
      _discovery: discovery,
    };
  }

  // 2. Fetch HTML
  let html;
  try {
    html = await fetchPageHtml(discovery.url);
  } catch (err) {
    return {
      _error: `Found page at ${discovery.url} but could not fetch it: ${err.message}`,
      _discovery: discovery,
    };
  }

  // 3. Extract structured data
  const pageData = await extractFn({
    html,
    sourceUrl: discovery.url,
    intentResult,
  });

  // 4. Attach discovery metadata
  pageData._discovery = {
    url:    discovery.url,
    title:  discovery.title,
    score:  discovery.score,
    source: discovery.source,
  };

  return pageData;
}