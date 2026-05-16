/**
 * CivicChat.jsx  (final — all prompt engineering modules integrated)
 *
 * Module integration map:
 *
 *   User types message
 *     │
 *     ├── civic-language.js        detectLanguage → normaliseQuery
 *     ├── civic-query-rewrite.js   normaliseForSearch (strips filler before intent)
 *     │
 *     ├── civic-intent-detection.js  detectCivicIntent (on cleaned text)
 *     ├── civic-clarification-loop.js  processUserTurn → shouldClarify / resolveIntent
 *     │
 *     │   (if action: "act")
 *     ├── civic-query-rewrite.js   rewriteForDiscovery → search queries
 *     ├── civic-url-discovery.js   discoverUrl → fetchPageHtml
 *     ├── civic-extraction.js      extractPageData → PageData
 *     │
 *     └── ExtractionPreview.jsx    renders PageData cards (localised)
 */

import { useState, useRef, useEffect }  from "react";
import { detectCivicIntent }            from "./civic-intent-detection.js";
import {
  createConversationState,
  processUserTurn,
}                                        from "./civic-clarification-loop.js";
import {
  discoverUrl,
  fetchPageHtml,
}                                        from "./civic-url-discovery.js";
import { extractPageData }              from "./civic-extraction.js";
import ExtractionPreview                from "./ExtractionPreview.jsx";
import {
  detectLanguage,
  normaliseQuery     as langNormalise,
  injectLanguageRule,
  verifyResponseLanguage,
  buildCorrectionPrompt,
  getLabels,
  formatCurrency,
  formatDate,
  formatPhone,
  LANGUAGES,
}                                        from "./civic-language.js";
import {
  normaliseForSearch,
  rewriteForDiscovery,
}                                        from "./civic-query-rewrite.js";

// ─── Language-aware extract wrapper ───────────────────────────────────────────

function makeExtractFn(language) {
  return (args) => extractPageData({
    ...args,
    systemPromptPrefix: injectLanguageRule("", language),
  });
}

// ─── Discovery + extraction orchestrator ──────────────────────────────────────
//
// Replaces the old runDiscoveryAndExtraction call.
// Now uses the rewrite module to build search queries.

async function runFullPipeline(intentResult, rawNormalisedText) {
  const lang      = intentResult.language ?? "hr";
  const extractFn = makeExtractFn(lang);

  // 1. Rewrite query for search
  const queries = await rewriteForDiscovery(rawNormalisedText, intentResult);

  // 2. Discover URL (uses rewritten queries internally)
  //    discoverUrl already tries catalog first, then search.
  //    We pass the pre-rewritten queries so it doesn't re-derive them.
  const discovery = await discoverUrl(intentResult, { prewrittenQueries: queries });

  if (!discovery.url) {
    return {
      _error: discovery.warning ?? (
        lang === "hr"
          ? "Nisam pronašao odgovarajuću službenu stranicu."
          : "Could not find a matching official page."
      ),
      _discovery: discovery,
    };
  }

  // 3. Fetch HTML
  let html;
  try {
    html = await fetchPageHtml(discovery.url);
  } catch (err) {
    return {
      _error: lang === "hr"
        ? `Pronašao sam stranicu (${discovery.url}) ali je ne mogu otvoriti: ${err.message}`
        : `Found page at ${discovery.url} but could not fetch it: ${err.message}`,
      _discovery: discovery,
    };
  }

  // 4. Extract structured data
  const pageData = await extractFn({
    html,
    sourceUrl: discovery.url,
    intentResult,
  });

  pageData._discovery = {
    url:     discovery.url,
    title:   discovery.title,
    score:   discovery.score,
    source:  discovery.source,
    queries, // attach rewritten queries for debug visibility
  };

  return pageData;
}

// ─── Bubble components ────────────────────────────────────────────────────────

function LangBadge({ language }) {
  if (!language) return null;
  return (
    <span style={{
      fontSize: 11, padding: "2px 8px", borderRadius: 99, flexShrink: 0,
      background: "var(--color-background-secondary)",
      color: "var(--color-text-tertiary)",
      border: "0.5px solid var(--color-border-tertiary)",
    }}>
      {LANGUAGES[language]?.name ?? language}
    </span>
  );
}

function UserBubble({ text }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
      <div style={{
        background: "var(--color-background-info)", color: "var(--color-text-info)",
        borderRadius: "12px 12px 4px 12px",
        padding: "10px 14px", maxWidth: "75%", fontSize: 14, lineHeight: 1.5,
      }}>{text}</div>
    </div>
  );
}

function AssistantBubble({ text }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        background: "var(--color-background-secondary)",
        borderRadius: "12px 12px 12px 4px",
        padding: "10px 14px", maxWidth: "80%",
        fontSize: 14, lineHeight: 1.5, color: "var(--color-text-primary)",
      }}>{text}</div>
    </div>
  );
}

function ClarifyBubble({ question, chips, onChip, onText, language }) {
  const [typed, setTyped]       = useState("");
  const [submitted, setSubmit]  = useState(false);
  const isHr = language === "hr";

  return (
    <div style={{ marginBottom: 12 }}>
      <AssistantBubble text={question} />
      {chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 8px" }}>
          {chips.map(chip => (
            <button key={chip.slotValue}
                    onClick={() => { if (!submitted) { setSubmit(true); onChip(chip); } }}
                    disabled={submitted}
                    style={{ fontSize: 12, padding: "6px 12px", borderRadius: 99,
                             cursor: submitted ? "default" : "pointer",
                             opacity: submitted ? 0.5 : 1 }}>
              {chip.label}
            </button>
          ))}
        </div>
      )}
      {chips.length === 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={typed} onChange={e => setTyped(e.target.value)}
                 onKeyDown={e => { if (e.key === "Enter" && typed.trim() && !submitted) { setSubmit(true); onText(typed.trim()); } }}
                 placeholder={isHr ? "Upišite odgovor…" : "Type your answer…"}
                 disabled={submitted} style={{ flex: 1, fontSize: 13 }} />
          <button onClick={() => { if (typed.trim() && !submitted) { setSubmit(true); onText(typed.trim()); } }}
                  disabled={submitted || !typed.trim()}>
            {isHr ? "Pošalji" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingBubble({ stage, language }) {
  const L = {
    hr: { detecting: "Razumijem vaše pitanje…", rewriting: "Pripremam pretragu…", discovering: "Tražim pravu stranicu…", extracting: "Čitam stranicu…" },
    en: { detecting: "Understanding your question…", rewriting: "Preparing search…", discovering: "Finding the official page…", extracting: "Reading the page…" },
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
                  fontSize: 13, color: "var(--color-text-tertiary)" }}>
      <i className="ti ti-loader" aria-hidden="true" style={{ fontSize: 16 }} />
      {(L[language ?? "hr"] ?? L.hr)[stage] ?? "…"}
    </div>
  );
}

function ResultBubble({ pageData, intentResult, language }) {
  const disc = pageData._discovery;
  const L    = getLabels(language);
  return (
    <div style={{ marginBottom: 10 }}>
      {disc?.url && (
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)",
                      marginBottom: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <i className="ti ti-world" aria-hidden="true" style={{ fontSize: 13 }} />
          <a href={disc.url} target="_blank" rel="noreferrer"
             style={{ color: "var(--color-text-tertiary)" }}>
            {(() => { try { return new URL(disc.url).hostname; } catch { return disc.url; } })()}
          </a>
          <LangBadge language={language} />
          {disc.queries?.[0] && (
            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99,
                           background: "var(--color-background-secondary)",
                           color: "var(--color-text-tertiary)", maxWidth: 250,
                           overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={disc.queries.join(" | ")}>
              {disc.queries[0]}
            </span>
          )}
        </div>
      )}
      <ExtractionPreview
        pageData={pageData} intentResult={intentResult}
        language={language} labels={L}
        formatCurrency={(a, c) => formatCurrency(a, c, language)}
        formatDate={d => formatDate(d, language)}
        formatPhone={p => formatPhone(p, language)}
        preloaded
      />
    </div>
  );
}

function ErrorBubble({ message, url, language }) {
  const fallback = language === "hr"
    ? "Nije moguće pronaći traženu stranicu."
    : "Could not find the requested page.";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        background: "var(--color-background-danger)",
        border: "0.5px solid var(--color-border-danger)",
        borderRadius: "var(--border-radius-md)",
        padding: "10px 14px", fontSize: 13, color: "var(--color-text-danger)",
        display: "flex", alignItems: "flex-start", gap: 8,
      }}>
        <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: 16, marginTop: 1 }} />
        <div>
          {message ?? fallback}
          {url && (
            <div style={{ marginTop: 6 }}>
              <a href={url} target="_blank" rel="noreferrer"
                 style={{ color: "var(--color-text-danger)" }}>
                {language === "hr" ? "Otvorite stranicu →" : "Open page →"}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CivicChat() {
  const [messages, setMessages] = useState([{
    type: "assistant",
    text: "Zdravo! Kako vam mogu pomoći? / Hello! How can I help?",
  }]);
  const [input, setInput] = useState("");
  const [busy,  setBusy]  = useState(false);

  const convState = useRef(createConversationState());
  const scrollRef = useRef(null);

  // The most recent normalised user text — stored here so runAction can access it
  // for the query rewrite step without re-running normalisation.
  const lastNormalisedText = useRef("");

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeLang = convState.current.language ?? "hr";

  const push           = (msg)  => setMessages(m => [...m, msg]);
  const replaceLoading = (msg)  =>
    setMessages(m => [...m.filter(x => x.type !== "loading"), msg]);

  // ── Input processing pipeline ──────────────────────────────────────────────
  //
  // Three layers run on every typed message:
  //   1. Language detection + mixed-language normalisation  (civic-language.js)
  //   2. Filler stripping + diacritics fix                 (civic-query-rewrite.js)
  //   3. Result stored in lastNormalisedText for later rewrite

  function processInput(rawText) {
    // Layer 1: language
    const langDet = detectLanguage(rawText);
    const lang    = langDet.language;
    const langClean = langNormalise(rawText, lang);

    // Layer 2: search normalisation (strip filler, fix diacritics)
    const searchClean = normaliseForSearch(langClean, lang);

    // Persist language on first confident detection
    if (langDet.confidence >= 0.65 && !convState.current.language) {
      convState.current = { ...convState.current, language: lang };
    }

    lastNormalisedText.current = searchClean;

    return { normalised: searchClean, lang, isMixed: langDet.isMixed ?? false };
  }

  // ── Core action: discovery + extraction ─────────────────────────────────────

  async function runAction(intentResult) {
    const lang = intentResult.language ?? activeLang;

    push({ type: "loading", stage: "rewriting", language: lang });

    let pageData;
    try {
      // runFullPipeline handles rewrite → discover → fetch → extract
      pageData = await runFullPipeline(intentResult, lastNormalisedText.current);
    } catch (err) {
      replaceLoading({ type: "error", message: err.message, language: lang });
      return;
    }

    if (pageData._error) {
      replaceLoading({
        type: "error", message: pageData._error,
        url: pageData._discovery?.url, language: lang,
      });
      return;
    }

    replaceLoading({ type: "result", pageData, intentResult, language: lang });
  }

  // ── Unified turn handler ───────────────────────────────────────────────────

  async function handleTurn({ text = null, chip = null }) {
    if (busy) return;
    setBusy(true);

    let lang           = activeLang;
    let normalisedText = text;

    if (text) {
      const proc     = processInput(text);
      lang           = proc.lang;
      normalisedText = proc.normalised;

      push({ type: "user", text });

      if (proc.isMixed && !convState.current.language) {
        push({
          type: "assistant",
          text: lang === "hr" ? "Odgovaram na hrvatskom." : "I'll respond in English.",
        });
      }
    } else {
      push({ type: "user", text: chip.label });
    }

    push({ type: "loading", stage: "detecting", language: lang });

    try {
      const { state: newState, response } = await processUserTurn(
        convState.current,
        normalisedText,
        chip ?? null,
        detectCivicIntent,
      );

      if (!newState.language) newState.language = lang;
      convState.current = newState;

      if (response.type === "clarify") {
        replaceLoading({
          type: "clarify", question: response.question,
          chips: response.chips, language: newState.language,
        });
      } else {
        replaceLoading({ type: "loading", stage: "rewriting", language: newState.language });
        await runAction({ ...response.intentResult, language: newState.language });
      }
    } catch (err) {
      replaceLoading({ type: "error", message: err.message, language: lang });
    } finally {
      setBusy(false);
    }
  }

  // ── Public handlers ─────────────────────────────────────────────────────────

  const handleSend        = ()     => { const t = input.trim(); if (t) { setInput(""); handleTurn({ text: t }); } };
  const handleChip        = (chip) => handleTurn({ chip });
  const handleClarifyText = (text) => handleTurn({ text });

  // ── Render ──────────────────────────────────────────────────────────────────

  const placeholder = activeLang === "en"
    ? "Ask about any civic service…"
    : "Pitajte o gradskim uslugama…";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", maxWidth: 720, margin: "0 auto",
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1rem 0" }}>
        {messages.map((msg, i) => {
          const lang = msg.language ?? activeLang;
          switch (msg.type) {
            case "user":      return <UserBubble key={i} text={msg.text} />;
            case "assistant": return <AssistantBubble key={i} text={msg.text} />;
            case "clarify":   return (
              <ClarifyBubble key={i} question={msg.question} chips={msg.chips}
                             onChip={handleChip} onText={handleClarifyText} language={lang} />
            );
            case "loading":   return <LoadingBubble key={i} stage={msg.stage} language={lang} />;
            case "result":    return (
              <ResultBubble key={i} pageData={msg.pageData}
                            intentResult={msg.intentResult} language={lang} />
            );
            case "error":     return (
              <ErrorBubble key={i} message={msg.message} url={msg.url} language={lang} />
            );
            default: return null;
          }
        })}
        <div ref={scrollRef} />
      </div>

      <div style={{
        padding: "12px 1rem", display: "flex", gap: 8, alignItems: "center",
        borderTop: "0.5px solid var(--color-border-tertiary)",
        background: "var(--color-background-primary)",
      }}>
        {convState.current.language && <LangBadge language={convState.current.language} />}
        <input value={input} onChange={e => setInput(e.target.value)}
               onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
               placeholder={placeholder} disabled={busy}
               style={{ flex: 1, fontSize: 14 }} />
        <button onClick={handleSend} disabled={busy || !input.trim()}
                aria-label={activeLang === "hr" ? "Pošalji" : "Send"}>
          <i className="ti ti-send" aria-hidden="true" style={{ fontSize: 16 }} />
        </button>
      </div>
    </div>
  );
}