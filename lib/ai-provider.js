/**
 * AI provider resolution. Looks up a per-tenant key from
 * `ai_provider_keys` (BYO), then falls back to `process.env.OPENAI_API_KEY`
 * / `process.env.GEMINI_API_KEY`.
 *
 * The decrypted keys are cached for the lifetime of the process to avoid
 * repeated decryption on hot paths.
 */
import { decrypt } from './encryption'
import { query, queryOne } from './mysql'

const cache = new Map()

export async function resolveAIKey({ provider = 'gemini', userId = 'default' } = {}) {
  const cacheKey = `${userId}:${provider}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  let apiKey = null
  let source = 'env'
  let lastRotatedAt = null
  try {
    const row = await queryOne(
      `SELECT apiKey, lastRotatedAt FROM ai_provider_keys WHERE userId = ? AND provider = ? LIMIT 1`,
      [userId, provider]
    )
    if (row?.apiKey) {
      apiKey = await decrypt(row.apiKey)
      source = 'byo'
      lastRotatedAt = row.lastRotatedAt
    }
  } catch (e) {
    // table may not exist yet — fall through to env
  }
  if (!apiKey) {
    if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY || null
    else if (provider === 'gemini') apiKey = process.env.GEMINI_API_KEY || null
  }

  const result = { provider, apiKey, source, lastRotatedAt }
  cache.set(cacheKey, result)
  return result
}

export function clearAIKeyCache(userId = null) {
  if (userId) {
    for (const k of [...cache.keys()]) if (k.startsWith(`${userId}:`)) cache.delete(k)
  } else {
    cache.clear()
  }
}

export async function saveAIKey({ userId = 'default', provider, apiKey }) {
  const encrypted = await import('./encryption').then(m => m.encrypt(apiKey))
  await query(
    `INSERT INTO ai_provider_keys (userId, provider, apiKey)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE apiKey = VALUES(apiKey), lastRotatedAt = NOW()`,
    [userId, provider, encrypted]
  )
  clearAIKeyCache(userId)
  return { userId, provider, rotated: true }
}

export async function deleteAIKey({ userId = 'default', provider }) {
  await query(
    `DELETE FROM ai_provider_keys WHERE userId = ? AND provider = ?`,
    [userId, provider]
  )
  clearAIKeyCache(userId)
  return { userId, provider, removed: true }
}

export async function validateAIKey({ provider, apiKey }) {
  if (!apiKey) return { ok: false, reason: 'empty' }
  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) return { ok: false, reason: `http_${res.status}` }
      return { ok: true }
    }
    if (provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
      if (!res.ok) return { ok: false, reason: `http_${res.status}` }
      return { ok: true }
    }
    return { ok: false, reason: 'unknown_provider' }
  } catch (err) {
    return { ok: false, reason: err.message }
  }
}