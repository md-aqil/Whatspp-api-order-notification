import { v4 as uuidv4 } from 'uuid'
import { query, queryOne, queryMany } from '../mysql'

/**
 * Per-tenant feature flags.
 *
 *   flags = {
 *     'whatsapp_pay': { enabled: true, rollout: 1.0, updatedAt },
 *     'ab_split':     { enabled: true, rollout: 0.5, updatedAt },
 *     ...
 *   }
 *
 * Storage: `feature_flags` table, PK = (userId, flagKey).
 *
 *   Default flags are seeded on first call so unknown tenants get sensible
 *   defaults (all-off; admin flips per-tenant).
 */

const DEFAULT_FLAGS = {
  whatsapp_pay: { enabled: false, rollout: 0 },
  ab_split: { enabled: true, rollout: 1 },
  channels: { enabled: false, rollout: 0 },
  referrals: { enabled: true, rollout: 1 },
  vip_perks: { enabled: true, rollout: 1 },
  multimodal_ai: { enabled: true, rollout: 1 },
  reorder_sweep: { enabled: true, rollout: 1 },
  segment_send: { enabled: true, rollout: 1 },
  language_detect: { enabled: true, rollout: 1 },
  clv_milestone: { enabled: true, rollout: 1 },
  double_optin: { enabled: true, rollout: 1 },
  reorder_followup: { enabled: true, rollout: 0.5 }
}

/** Returns the merged flag set for a tenant, with defaults applied. */
export async function getFeatureFlags({ userId = 'default' } = {}) {
  const rows = await queryMany(
    `SELECT flagKey, enabled, rollout, updatedAt FROM feature_flags WHERE userId = ?`,
    [userId]
  ).catch(() => [])
  const merged = JSON.parse(JSON.stringify(DEFAULT_FLAGS))
  for (const r of rows) {
    merged[r.flagKey] = {
      enabled: !!r.enabled,
      rollout: Number(r.rollout ?? 0),
      updatedAt: r.updatedAt
    }
  }
  return merged
}

/** Read a single flag with defaults. */
export async function isFeatureEnabled({ userId = 'default', flagKey, hashKey = null } = {}) {
  const flags = await getFeatureFlags({ userId })
  const flag = flags[flagKey] || DEFAULT_FLAGS[flagKey]
  if (!flag) return false
  if (!flag.enabled) return false
  if (flag.rollout >= 1) return true
  if (flag.rollout <= 0) return false
  if (!hashKey) return true
  // Stable per-recipient hash: convert "userId:hashKey" to [0, 1) and check
  // against the rollout fraction.
  const h = simpleHash(`${userId}:${flagKey}:${hashKey}`)
  return (h % 10000) / 10000 < flag.rollout
}

/** Upsert a flag (admin-only, must be guarded by caller). */
export async function setFeatureFlag({ userId = 'default', flagKey, enabled, rollout = 1 }) {
  if (!flagKey) throw new Error('flagKey required')
  await query(
    `INSERT INTO feature_flags (id, userId, flagKey, enabled, rollout, updatedAt)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), rollout = VALUES(rollout), updatedAt = NOW()`,
    [uuidv4(), userId, String(flagKey).slice(0, 64), enabled ? 1 : 0, Number(rollout) || 0]
  )
  return { userId, flagKey, enabled: !!enabled, rollout: Number(rollout) || 0 }
}

function simpleHash(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i)
  }
  return Math.abs(h | 0)
}