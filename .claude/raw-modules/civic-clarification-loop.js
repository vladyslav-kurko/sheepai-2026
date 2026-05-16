/**
 * civic-clarification-loop.js
 *
 * Stateful clarification loop for the civic assistant.
 *
 * Responsibilities:
 *   1. ConversationState  — persists intent + slots across turns
 *   2. shouldClarify()    — decides whether to ask, act, or give up
 *   3. buildClarification() — picks the right question + chips
 *   4. mergeClarification() — folds chip/text answer back into state
 *   5. resolveIntent()    — final merged IntentResult ready for discovery
 *
 * Design rules:
 *   - Ask at most ONE question per turn, never two
 *   - Ask at most TWICE per conversation, then proceed with best guess
 *   - Chip answers re-enter as structured data, not raw text
 *   - Slots accumulate — never forgotten between turns
 *   - Tie between two intents → ask; tie on second turn → pick higher keyword score
 */

import { INTENTS, classifyByKeywords, extractSlotsLocally } from "./civic-intent-detection.js";

// ─── CONVERSATION STATE ───────────────────────────────────────────────────────

/**
 * Creates a fresh ConversationState for a new session.
 * Store one per chat session (in React: useState, Zustand, or useRef).
 */
export function createConversationState() {
  return {
    // Accumulated intent across turns
    intent:             null,   // best-guess intent key
    intentLabel:        null,
    confidence:         0,

    // Accumulated slots — merged from every turn
    slots:              {},

    // Context
    city:               null,
    language:           null,
    isUrgent:           false,

    // Clarification tracking
    clarificationCount: 0,      // how many times we've asked
    clarificationTopic: null,   // which slot/issue we last asked about
    lastChips:          [],     // chips shown in last clarification

    // Module routing
    modulesToRender:    [],

    // Turn history (lightweight — just what matters for merging)
    turns: [],                  // [{ role, content, intent, slots }]
  };
}

// ─── SLOT SUFFICIENCY RULES ───────────────────────────────────────────────────
//
// For each intent, defines what's the minimum we need to act.
// "act" = proceed to URL discovery without asking more.

const SUFFICIENCY = {
  permit:      (slots) => !!(slots.permit_type),
  payment:     (slots) => !!(slots.fee_type),
  appointment: (slots) => !!(slots.service_type),
  document:    (slots) => !!(slots.document_type),
  complaint:   (slots) => !!(slots.complaint_type && slots.location),
  info:        (slots) => true,   // info is always sufficient — just search
};

// ─── CLARIFICATION QUESTION BANK ─────────────────────────────────────────────
//
// Each entry maps a missing slot → { question, chips }.
// Chips are structured: { label, slotKey, slotValue } so merging is exact.

const CLARIFICATION_QUESTIONS = {
  // Intent-level (we don't know what they want at all)
  unknown_intent: {
    question: "What do you need help with?",
    chips: [
      { label: "Get a document",      slotKey: "__intent__", slotValue: "document" },
      { label: "Apply for a permit",  slotKey: "__intent__", slotValue: "permit" },
      { label: "Make a payment",      slotKey: "__intent__", slotValue: "payment" },
      { label: "Book an appointment", slotKey: "__intent__", slotValue: "appointment" },
      { label: "Report a problem",    slotKey: "__intent__", slotValue: "complaint" },
    ],
  },

  // Intent tie-breaking
  permit_vs_document: {
    question: "Are you applying for a permit, or obtaining a document?",
    chips: [
      { label: "Permit / licence",       slotKey: "__intent__", slotValue: "permit" },
      { label: "Document / certificate", slotKey: "__intent__", slotValue: "document" },
    ],
  },
  payment_vs_info: {
    question: "Do you need to make a payment, or just find information?",
    chips: [
      { label: "I need to pay something", slotKey: "__intent__", slotValue: "payment" },
      { label: "Just looking for info",   slotKey: "__intent__", slotValue: "info" },
    ],
  },

  // Slot-level: document type
  document_type: {
    question: "Which document do you need?",
    chips: [
      { label: "ID card (osobna)",        slotKey: "document_type", slotValue: "osobna iskaznica" },
      { label: "Passport (putovnica)",     slotKey: "document_type", slotValue: "putovnica" },
      { label: "Birth certificate",        slotKey: "document_type", slotValue: "rodni list" },
      { label: "Citizenship cert.",        slotKey: "document_type", slotValue: "domovnica" },
      { label: "Driving licence",          slotKey: "document_type", slotValue: "vozačka dozvola" },
    ],
  },

  // Slot-level: permit type
  permit_type: {
    question: "What kind of permit do you need?",
    chips: [
      { label: "Building permit",   slotKey: "permit_type", slotValue: "građevinska dozvola" },
      { label: "Trade licence",     slotKey: "permit_type", slotValue: "obrt" },
      { label: "Signage permit",    slotKey: "permit_type", slotValue: "natpis" },
      { label: "Terrace permit",    slotKey: "permit_type", slotValue: "terasa" },
    ],
  },

  // Slot-level: fee type
  fee_type: {
    question: "Which fee are you paying?",
    chips: [
      { label: "Communal fee",   slotKey: "fee_type", slotValue: "komunalna naknada" },
      { label: "Property tax",   slotKey: "fee_type", slotValue: "porez na nekretnine" },
      { label: "Parking fine",   slotKey: "fee_type", slotValue: "kazna za parkiranje" },
      { label: "Other fee",      slotKey: "fee_type", slotValue: "ostalo" },
    ],
  },

  // Slot-level: appointment service
  service_type: {
    question: "What appointment do you need?",
    chips: [
      { label: "Civil registry (matičar)", slotKey: "service_type", slotValue: "matičar" },
      { label: "Building department",      slotKey: "service_type", slotValue: "prostorno planiranje" },
      { label: "Social services",          slotKey: "service_type", slotValue: "socijalna skrb" },
      { label: "Police / MUP",             slotKey: "service_type", slotValue: "MUP" },
    ],
  },

  // Slot-level: complaint type
  complaint_type: {
    question: "What are you reporting?",
    chips: [
      { label: "Pothole / road damage", slotKey: "complaint_type", slotValue: "rupa" },
      { label: "Noise",                 slotKey: "complaint_type", slotValue: "buka" },
      { label: "Illegal dumping",       slotKey: "complaint_type", slotValue: "divlje odlaganje" },
      { label: "Broken infrastructure", slotKey: "complaint_type", slotValue: "kvar" },
      { label: "Illegal parking",       slotKey: "complaint_type", slotValue: "nepropisno parkiranje" },
    ],
  },

  // Slot-level: location for complaint
  complaint_location: {
    question: "Where is this located? (street name or neighbourhood)",
    chips: [],  // free-text — no chips for location
  },

  // City missing
  city: {
    question: "Which city are you in?",
    chips: [
      { label: "Zagreb",  slotKey: "city", slotValue: "Zagreb" },
      { label: "Split",   slotKey: "city", slotValue: "Split" },
      { label: "Rijeka",  slotKey: "city", slotValue: "Rijeka" },
      { label: "Osijek",  slotKey: "city", slotValue: "Osijek" },
      { label: "Zadar",   slotKey: "city", slotValue: "Zadar" },
    ],
  },
};

// ─── INTENT TIE-DETECTOR ─────────────────────────────────────────────────────

function detectTie(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted.length < 2) return null;
  const [first, second] = sorted;
  // Tie = top two scores within 1 point of each other and both > 0
  if (first[1] > 0 && second[1] > 0 && first[1] - second[1] <= 1) {
    return [first[0], second[0]];  // e.g. ['permit', 'document']
  }
  return null;
}

// ─── SHOULD CLARIFY ───────────────────────────────────────────────────────────

/**
 * Decides whether to ask a clarification question, and which one.
 *
 * Returns one of:
 *   { action: "act" }                          — enough info, proceed
 *   { action: "clarify", questionKey: string } — ask this question
 *   { action: "proceed_anyway" }               — hit max clarifications, best-guess
 */
export function shouldClarify(state, classificationResult) {
  const { intent, confidence, scores } = classificationResult;
  const MAX_CLARIFICATIONS = 2;

  // Already asked enough — proceed with best guess
  if (state.clarificationCount >= MAX_CLARIFICATIONS) {
    return { action: "proceed_anyway" };
  }

  // No intent signal at all
  if (!intent || confidence < 0.3) {
    return { action: "clarify", questionKey: "unknown_intent" };
  }

  // Intent tie — ask to disambiguate (but only once)
  const tie = detectTie(scores);
  if (tie && state.clarificationCount === 0) {
    const tieKey = `${tie[0]}_vs_${tie[1]}`;
    if (CLARIFICATION_QUESTIONS[tieKey]) {
      return { action: "clarify", questionKey: tieKey };
    }
  }

  // Intent known — check slot sufficiency
  const mergedSlots = { ...state.slots, ...(classificationResult.slots ?? {}) };
  const sufficient  = (SUFFICIENCY[intent] ?? (() => true))(mergedSlots);

  if (sufficient) {
    return { action: "act" };
  }

  // Find which slot is missing and ask for it
  const intentDef  = INTENTS[intent];
  const missingSlot = intentDef?.slots?.find(s => !mergedSlots[s] && CLARIFICATION_QUESTIONS[s]);

  if (missingSlot) {
    // Don't re-ask the same question we just asked
    if (missingSlot === state.clarificationTopic) {
      return { action: "act" };  // user ignored it — proceed
    }
    return { action: "clarify", questionKey: missingSlot };
  }

  // City missing (applies to all intents except national ones)
  if (!state.city && !mergedSlots.city && state.clarificationCount === 0) {
    return { action: "clarify", questionKey: "city" };
  }

  return { action: "act" };
}

// ─── BUILD CLARIFICATION RESPONSE ────────────────────────────────────────────

/**
 * Returns the question text and chips to show the user.
 * Call this when shouldClarify() returns { action: "clarify" }.
 */
export function buildClarification(questionKey) {
  const q = CLARIFICATION_QUESTIONS[questionKey];
  if (!q) {
    // Fallback
    return {
      question: "Could you give me a bit more detail about what you need?",
      chips: [],
      questionKey: "fallback",
    };
  }
  return { ...q, questionKey };
}

// ─── MERGE CLARIFICATION ANSWER ───────────────────────────────────────────────

/**
 * Folds the user's clarification answer back into ConversationState.
 *
 * chipAnswer: { label, slotKey, slotValue } — when user tapped a chip
 * textAnswer: string                        — when user typed free text
 *
 * Returns updated state (immutable — returns new object).
 */
export function mergeClarificationAnswer(state, { chipAnswer = null, textAnswer = null }) {
  const updated = {
    ...state,
    clarificationCount: state.clarificationCount + 1,
    clarificationTopic: null,
    lastChips: [],
  };

  if (chipAnswer) {
    const { slotKey, slotValue } = chipAnswer;

    if (slotKey === "__intent__") {
      // User picked an intent directly
      updated.intent      = slotValue;
      updated.intentLabel = INTENTS[slotValue]?.label ?? slotValue;
      updated.confidence  = 0.95;
      updated.modulesToRender = INTENTS[slotValue]?.modules ?? [];
    } else if (slotKey === "city") {
      updated.city = slotValue;
    } else {
      // Regular slot value
      updated.slots = { ...updated.slots, [slotKey]: slotValue };
    }
  }

  if (textAnswer && !chipAnswer) {
    // Run intent detection on the free-text answer and merge
    const redetect = classifyByKeywords(textAnswer);
    if (redetect.rawScore > 0 && !updated.intent) {
      updated.intent      = redetect.intent;
      updated.confidence  = redetect.confidence;
      updated.modulesToRender = INTENTS[redetect.intent]?.modules ?? [];
    }
    // Also try slot extraction on the text
    const newSlots = updated.intent
      ? extractSlotsLocally(textAnswer, updated.intent)
      : {};
    updated.slots = { ...updated.slots, ...Object.fromEntries(
      Object.entries(newSlots).filter(([, v]) => v != null)
    )};

    // Special: if question was about city and user typed a city name
    if (state.clarificationTopic === "city") {
      updated.city = textAnswer.trim();
    }
  }

  return updated;
}

// ─── MERGE FULL TURN INTO STATE ───────────────────────────────────────────────

/**
 * Merges a complete IntentResult (from detectCivicIntent) into ConversationState.
 * Called on every user turn — accumulates slots, upgrades intent if more confident.
 *
 * Returns updated state.
 */
export function mergeTurnIntoState(state, intentResult, rawMessage) {
  const updated = { ...state };

  // Upgrade intent if new detection is more confident
  if (intentResult.confidence > (state.confidence ?? 0)) {
    updated.intent        = intentResult.intent;
    updated.intentLabel   = intentResult.intentLabel;
    updated.confidence    = intentResult.confidence;
    updated.modulesToRender = intentResult.modulesToRender ?? [];
  }

  // Merge slots — existing values take priority (don't overwrite with null)
  const newSlots = intentResult.slots ?? {};
  updated.slots = {
    ...newSlots,
    ...Object.fromEntries(Object.entries(state.slots).filter(([, v]) => v != null)),
  };

  // Upgrade city if now detected
  if (intentResult.city && !state.city) updated.city = intentResult.city;

  // Language (first detection wins)
  if (intentResult.language && !state.language) updated.language = intentResult.language;

  // Urgency is additive
  if (intentResult.isUrgent) updated.isUrgent = true;

  // Append turn summary
  updated.turns = [
    ...state.turns,
    {
      role:    "user",
      content: rawMessage,
      intent:  intentResult.intent,
      slots:   newSlots,
    },
  ];

  return updated;
}

// ─── RESOLVE INTENT ───────────────────────────────────────────────────────────

/**
 * Produces the final IntentResult from ConversationState.
 * This is what gets passed to runDiscoveryAndExtraction().
 */
export function resolveIntent(state) {
  return {
    intent:           state.intent ?? "info",
    intentLabel:      state.intentLabel ?? "General info",
    confidence:       state.confidence ?? 0.5,
    slots:            state.slots,
    city:             state.city,
    language:         state.language ?? "hr",
    isUrgent:         state.isUrgent,
    modulesToRender:  state.modulesToRender.length
                        ? state.modulesToRender
                        : (INTENTS[state.intent]?.modules ?? ["hours", "contact"]),
    needsClarification: false,  // already handled by this loop
    clarificationQuestion: null,
  };
}

// ─── MAIN LOOP STEP ───────────────────────────────────────────────────────────

/**
 * processUserTurn() — the single function the chat UI calls on every message.
 *
 * Handles both normal turns and chip-answer turns.
 * Returns { state, response } where response is one of:
 *
 *   { type: "clarify", question: string, chips: Chip[] }
 *     → UI should display the question and chips, wait for next input
 *
 *   { type: "act", intentResult: IntentResult }
 *     → UI should call runDiscoveryAndExtraction(intentResult) and render cards
 *
 * @param {object} state           — current ConversationState
 * @param {string} rawMessage      — user's raw text (null if chip tap)
 * @param {object|null} chipAnswer — { label, slotKey, slotValue } if chip tapped
 * @param {function} detectIntent  — detectCivicIntent from civic-intent-detection.js
 */
export async function processUserTurn(state, rawMessage, chipAnswer, detectIntent) {

  // ── Case A: User tapped a chip ────────────────────────────────────────────
  if (chipAnswer) {
    const updatedState = mergeClarificationAnswer(state, { chipAnswer });

    // Re-check sufficiency with merged state
    const classResult = {
      intent:     updatedState.intent,
      confidence: updatedState.confidence,
      scores:     {},
      slots:      updatedState.slots,
    };
    const decision = shouldClarify(updatedState, classResult);

    if (decision.action === "clarify") {
      const clarification = buildClarification(decision.questionKey);
      return {
        state: {
          ...updatedState,
          clarificationTopic: decision.questionKey,
          lastChips: clarification.chips,
        },
        response: {
          type:     "clarify",
          question: clarification.question,
          chips:    clarification.chips,
        },
      };
    }

    // Enough info — act
    return {
      state:    updatedState,
      response: { type: "act", intentResult: resolveIntent(updatedState) },
    };
  }

  // ── Case B: User typed a message ──────────────────────────────────────────

  // If we were waiting for free-text clarification, merge it
  let workingState = state;
  if (state.clarificationTopic && !chipAnswer) {
    workingState = mergeClarificationAnswer(state, { textAnswer: rawMessage });
  }

  // Run full intent detection on the raw message
  const intentResult  = await detectIntent(rawMessage);

  // Merge into state (accumulate slots, upgrade intent if better)
  const updatedState  = mergeTurnIntoState(workingState, intentResult, rawMessage);

  // Decide
  const classResult = {
    intent:     updatedState.intent,
    confidence: updatedState.confidence,
    scores:     intentResult._scores ?? {},
    slots:      updatedState.slots,
  };
  const decision = shouldClarify(updatedState, classResult);

  if (decision.action === "clarify") {
    const clarification = buildClarification(decision.questionKey);
    return {
      state: {
        ...updatedState,
        clarificationTopic: decision.questionKey,
        lastChips: clarification.chips,
        clarificationCount: updatedState.clarificationCount + 1,
      },
      response: {
        type:     "clarify",
        question: clarification.question,
        chips:    clarification.chips,
      },
    };
  }

  // Act — either confident or hit max clarifications
  return {
    state:    updatedState,
    response: { type: "act", intentResult: resolveIntent(updatedState) },
  };
}