import { query, queryOne } from './mysql'

const TTL_HOURS = 72

/**
 * Check if we've already sent an outbound WhatsApp message for this idempotency key.
 * If yes, return the cached result. Otherwise call the sender and persist the result.
 *
 * @param {object} args
 * @param {string} args.idempotencyKey - stable hash identifying the send
 * @param {object} args.context - arbitrary data stored alongside the record
 * @param {Function} args.send - async () => result; the actual Meta API call
 * @returns {Promise<{success:boolean, result:any, wamid:string, duplicate:boolean}>}
 */
export async function sendWithIdempotency({ idempotencyKey, context = {}, send }) {
  if (!idempotencyKey) {
    // Caller did not supply a key: just send (legacy behaviour)
    const result = await send()
    return {
      success: !result?.error,
      result,
      wamid: result?.messages?.[0]?.id || null,
      duplicate: false
    }
  }

  // Look up a recent successful send with this key
  const existing = await queryOne(
    `SELECT id, wamid, result FROM outbound_idempotency
     WHERE idempotency_key = ?
       AND createdAt >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     LIMIT 1`,
    [idempotencyKey, TTL_HOURS]
  )

  if (existing) {
    console.log(`[Idempotency] Suppressed duplicate send for key=${idempotencyKey} (wamid=${existing.wamid})`)
    return {
      success: true,
      result: existing.result ? safeJsonParse(existing.result) : null,
      wamid: existing.wamid,
      duplicate: true
    }
  }

  const result = await send()
  const success = !result?.error
  const wamid = result?.messages?.[0]?.id || null

  try {
    await query(
      `INSERT INTO outbound_idempotency (id, idempotency_key, wamid, success, result, context, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        `idem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        idempotencyKey,
        wamid,
        success ? 1 : 0,
        JSON.stringify(result || {}),
        JSON.stringify(context || {})
      ]
    )
  } catch (persistErr) {
    console.warn('[Idempotency] Failed to persist record:', persistErr.message)
  }

  return { success, result, wamid, duplicate: false }
}

function safeJsonParse(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch (e) {
    return null
  }
}