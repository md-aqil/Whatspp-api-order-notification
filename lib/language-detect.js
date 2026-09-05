import { httpClient } from './httpClient'
import { metricsService } from './metrics'
import { query } from './mysql'

/**
 * Language detection. Uses:
 *   1. Cached preference (conversation_metrics.languagePreference)
 *   2. Cheap heuristic regex (common Indic / Arabic / Spanish markers)
 *   3. Gemini fallback for ambiguous text
 *
 * Returns { code, name, confidence } where code is a BCP-47-ish short tag.
 */

const HEURISTIC_RULES = [
  { regex: /[\u0900-\u097F]/, code: 'hi', name: 'Hindi' },
  { regex: /[\u0980-\u09FF]/, code: 'bn', name: 'Bengali' },
  { regex: /[\u0A00-\u0A7F]/, code: 'pa', name: 'Punjabi' },
  { regex: /[\u0A80-\u0AFF]/, code: 'gu', name: 'Gujarati' },
  { regex: /[\u0B00-\u0B7F]/, code: 'or', name: 'Odia' },
  { regex: /[\u0B80-\u0BFF]/, code: 'ta', name: 'Tamil' },
  { regex: /[\u0C00-\u0C7F]/, code: 'te', name: 'Telugu' },
  { regex: /[\u0C80-\u0CFF]/, code: 'kn', name: 'Kannada' },
  { regex: /[\u0D00-\u0D7F]/, code: 'ml', name: 'Malayalam' },
  { regex: /[\u0600-\u06FF]/, code: 'ar', name: 'Arabic' },
  { regex: /[\u4E00-\u9FFF]/, code: 'zh', name: 'Chinese' },
  { regex: /[\u3040-\u309F\u30A0-\u30FF]/, code: 'ja', name: 'Japanese' },
  { regex: /[\uAC00-\uD7AF]/, code: 'ko', name: 'Korean' },
  { regex: /[\u0400-\u04FF]/, code: 'ru', name: 'Russian' },
  // Latin-based heuristics
  { regex: /\b(merci|bonjour|salut|commande|livraison|où)\b/i, code: 'fr', name: 'French' },
  { regex: /\b(hola|gracias|pedido|envío|dónde|cuánto)\b/i, code: 'es', name: 'Spanish' },
  { regex: /\b(olá|obrigado|pedido|entrega|quanto)\b/i, code: 'pt', name: 'Portuguese' },
  { regex: /\b(hallo|danke|bestellung|lieferung|wie)\b/i, code: 'de', name: 'German' }
]

export function detectLanguageHeuristic(text = '') {
  if (!text) return null
  for (const rule of HEURISTIC_RULES) {
    if (rule.regex.test(text)) {
      return { code: rule.code, name: rule.name, confidence: 0.9, source: 'heuristic' }
    }
  }
  return null
}

/**
 * LLM-based language detection for ambiguous (Latin script) text.
 * Returns { code, name, confidence } or null on failure.
 */
export async function detectLanguageWithLLM(text) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || !text || text.length < 5) return null

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
    const response = await httpClient.post(url, {
      contents: [{
        parts: [{
          text: `Detect the language of this message and respond with ONLY a JSON object: {"code":"xx","name":"English"}.\n\nMessage: "${text.replace(/"/g, '\\"').substring(0, 500)}"`
        }]
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 30 }
    })

    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (parsed?.code) {
        return { code: parsed.code, name: parsed.name || parsed.code, confidence: 0.75, source: 'llm' }
      }
    }
    metricsService.incrementCounter('ai_language_detection_total', { status: 'success' })
    return null
  } catch (err) {
    metricsService.incrementCounter('ai_language_detection_total', { status: 'error' })
    console.warn('[Language Detection] LLM error:', err.message)
    return null
  }
}

/**
 * Combined detection: cached preference → heuristic → LLM.
 * Persists detected language to conversation_metrics for next time.
 */
export async function detectAndPersistLanguage({ userId = 'default', customerPhone, text }) {
  const normalized = String(customerPhone || '').replace(/\D/g, '')
  if (!normalized || !text) return null

  try {
    const [cached] = await query(
      `SELECT languagePreference FROM conversation_metrics WHERE userId = ? AND customerPhone = ? LIMIT 1`,
      [userId, normalized]
    )
    if (cached?.languagePreference) {
      return { code: cached.languagePreference, name: cached.languagePreference, confidence: 1, source: 'cache' }
    }
  } catch (e) {}

  let detected = detectLanguageHeuristic(text)
  if (!detected) {
    detected = await detectLanguageWithLLM(text)
  }
  if (!detected) {
    detected = { code: 'en', name: 'English', confidence: 0.5, source: 'fallback' }
  }

  try {
    await query(
      `INSERT INTO conversation_metrics (id, userId, customerPhone, detectedLanguage, languagePreference, lastInteractionAt, totalInteractions)
       VALUES (?, ?, ?, ?, ?, NOW(), 1)
       ON DUPLICATE KEY UPDATE
         detectedLanguage = VALUES(detectedLanguage),
         languagePreference = VALUES(languagePreference),
         lastInteractionAt = NOW(),
         totalInteractions = totalInteractions + 1`,
      [`cm_${userId}_${normalized}`, userId, normalized, detected.code, detected.code]
    )
  } catch (e) {}

  return detected
}

/**
 * Map a detected language code to a natural-language instruction we can
 * prepend to AI step prompts.
 */
export function languageDirective(code = 'en') {
  const map = {
    hi: 'Hindi (हिंदी)',
    bn: 'Bengali (বাংলা)',
    ta: 'Tamil (தமிழ்)',
    te: 'Telugu (తెలుగు)',
    kn: 'Kannada (ಕನ್ನಡ)',
    ml: 'Malayalam (മലയാളം)',
    mr: 'Marathi (मराठी)',
    gu: 'Gujarati (ગુજરાતી)',
    pa: 'Punjabi (ਪੰਜਾਬੀ)',
    ar: 'Arabic (العربية)',
    es: 'Spanish (Español)',
    fr: 'French (Français)',
    pt: 'Portuguese (Português)',
    de: 'German (Deutsch)',
    zh: 'Chinese (中文)',
    ja: 'Japanese (日本語)',
    ko: 'Korean (한국어)',
    ru: 'Russian (Русский)',
    en: 'English'
  }
  const name = map[code] || map.en
  return `Reply ONLY in ${name}. If you don't know a word, use the closest equivalent in ${name} or keep it simple.`
}