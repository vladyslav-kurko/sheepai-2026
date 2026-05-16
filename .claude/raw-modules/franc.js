async function normalizeQuery(userMessage) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `You detect the dominant language in mixed messages and translate the full message to that language.
Respond ONLY with valid JSON: { "dominant": "en", "normalized": "...", "wasMixed": true }
No markdown, no explanation.`,
      messages: [{ role: 'user', content: userMessage }]
    })
  })
  const data = await response.json()
  const raw = data.content[0].text.replace(/```json|```/g, '').trim()
  return JSON.parse(raw)
}

import { franc } from 'franc'

const LOW_CONFIDENCE_LANGS = ['und', 'afr', 'sot'] // franc struggles with these

async function prepareMessage(userMessage) {
  const iso3 = franc(userMessage, { minLength: 10 })

  // High confidence: just detect, no extra API call needed
  if (iso3 !== 'und' && !LOW_CONFIDENCE_LANGS.includes(iso3)) {
    const isMixed = isMixedLanguage(userMessage, iso3)
    if (!isMixed) return { text: userMessage, lang: iso3, normalized: false }
  }

  // Low confidence or mixed: fall back to Claude
  return await normalizeQuery(userMessage)
}

function isMixedLanguage(text, dominantIso3) {
  // Split into chunks and re-detect each
  const words = text.split(/\s+/)
  const mid = Math.floor(words.length / 2)
  const half1 = words.slice(0, mid).join(' ')
  const half2 = words.slice(mid).join(' ')

  const lang1 = franc(half1, { minLength: 5 })
  const lang2 = franc(half2, { minLength: 5 })

  return lang1 !== 'und' && lang2 !== 'und' && lang1 !== lang2
}