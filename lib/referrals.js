import { v4 as uuidv4 } from 'uuid'
import { query, queryOne, queryMany } from './mysql'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generate a short, URL-safe referral code like 'VACLAV-AB12CD'.
 */
export function generateReferralCode(prefix = 'VACLAV') {
  const safePrefix = String(prefix || 'VACLAV')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .substring(0, 12) || 'REF'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return `${safePrefix}-${suffix}`
}

/**
 * Get or create a referral code for a customer. Idempotent.
 */
export async function getOrCreateReferralCode({ userId = 'default', customerPhone, prefix }) {
  if (!customerPhone) return null
  const normalized = String(customerPhone).replace(/\D/g, '')
  const existing = await queryOne(
    `SELECT * FROM referral_codes WHERE userId = ? AND customerPhone = ? LIMIT 1`,
    [userId, normalized]
  )
  if (existing?.code && existing.status === 'active') return existing

  const id = `ref_${uuidv4()}`
  // Retry up to 5 times in the (extremely unlikely) event of a collision
  let code = generateReferralCode(prefix)
  for (let i = 0; i < 5; i++) {
    const clash = await queryOne(`SELECT id FROM referral_codes WHERE code = ? LIMIT 1`, [code])
    if (!clash) break
    code = generateReferralCode(prefix)
  }

  if (existing) {
    await query(
      `UPDATE referral_codes SET code = ?, status = 'active', updatedAt = NOW() WHERE id = ?`,
      [code, existing.id]
    )
    return { ...existing, code, status: 'active' }
  }

  await query(
    `INSERT INTO referral_codes (id, userId, customerPhone, code, status, createdAt)
     VALUES (?, ?, ?, ?, 'active', NOW())`,
    [id, userId, normalized, code]
  )
  return { id, userId, customerPhone: normalized, code, status: 'active' }
}

/**
 * Look up a referral code's owner. Returns null if not found or inactive.
 */
export async function findReferralOwner({ code }) {
  if (!code) return null
  return queryOne(
    `SELECT * FROM referral_codes WHERE code = ? AND status = 'active' LIMIT 1`,
    [String(code).toUpperCase()]
  )
}

/**
 * Mark a successful referral (referee placed a paying order). Bumps counters
 * and (optionally) issues a thank-you gift card.
 */
export async function recordReferralConversion({ code }) {
  if (!code) return
  await query(
    `UPDATE referral_codes
     SET successfulOrders = successfulOrders + 1,
         refereeCount = refereeCount + 1,
         updatedAt = NOW()
     WHERE code = ?`,
    [String(code).toUpperCase()]
  )
}

/**
 * Spin-the-wheel helper: pick a random weighted tier.
 *
 *   tiers = [{ id: 'small', weight: 60, valueType: 'percentage', value: 5 },
 *            { id: 'medium', weight: 30, valueType: 'percentage', value: 10 },
 *            { id: 'large', weight: 9, valueType: 'percentage', value: 20 },
 *            { id: 'jackpot', weight: 1, valueType: 'fixed_amount', value: 50 }]
 *
 * Returns the chosen tier object.
 */
export function pickWeightedTier(tiers = []) {
  if (!Array.isArray(tiers) || tiers.length === 0) return null
  const totalWeight = tiers.reduce((sum, t) => sum + (Number(t.weight) || 0), 0)
  if (totalWeight <= 0) return tiers[0]
  let pick = Math.random() * totalWeight
  for (const tier of tiers) {
    pick -= Number(tier.weight) || 0
    if (pick <= 0) return tier
  }
  return tiers[tiers.length - 1]
}