/**
 * VIP tier-based reward config.
 *
 * Returns the recommended discount / perk for a given customer tier, used by
 * the engine when a step type `vip_perk` fires.
 */
export const TIER_PERKS = {
  bronze: { percentOff: 0, freeShipping: false, freeGift: false, minOrder: 0, prefix: 'BRONZE' },
  silver: { percentOff: 5, freeShipping: false, freeGift: false, minOrder: 0, prefix: 'SILVER' },
  gold: { percentOff: 10, freeShipping: true, freeGift: false, minOrder: 0, prefix: 'GOLD' },
  platinum: { percentOff: 15, freeShipping: true, freeGift: true, minOrder: 0, prefix: 'PLAT' }
}

export function perksForTier(tier = 'new') {
  return TIER_PERKS[tier] || TIER_PERKS.bronze
}

/**
 * Should this customer get a perk right now? Skips if a perk has been
 * issued in the last `cooldownDays` (default 14).
 */
export function shouldIssuePerk({ tier, lastIssuedAt, cooldownDays = 14 }) {
  if (!tier || tier === 'new' || tier === 'bronze') return false
  if (!lastIssuedAt) return true
  const age = (Date.now() - new Date(lastIssuedAt).getTime()) / (24 * 60 * 60 * 1000)
  return age >= cooldownDays
}