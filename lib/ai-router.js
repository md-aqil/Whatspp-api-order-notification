/**
 * Cost-aware LLM router.
 *
 * Picks the cheapest model that meets a `minQuality` bar (0..1). Caller
 * provides the candidates, the prices (per 1K input tokens, per 1K output
 * tokens) and a `qualityHint` per model. Selection favours low cost when
 * quality differences are within the slack.
 *
 *   - minQuality: 0 = cheapest model that's not absurd; 1 = flagship only
 *   - preferCheapWithin: if two models both satisfy minQuality and the
 *     cheaper one is within (1 - preferCheapWithin) of the more expensive
 *     model's quality, the cheaper one wins.
 *
 * The model itself is just a string — the AI caller is responsible for
 * actually using it (e.g. as the `model` param to Gemini's `generateContent`).
 */

const DEFAULT_CATALOG = [
  // Gemini family (cheapest → most capable)
  { id: 'gemini-1.5-flash-8b',   input: 0.0000375, output: 0.000150, quality: 0.45, provider: 'gemini' },
  { id: 'gemini-1.5-flash',      input: 0.000075,  output: 0.000300, quality: 0.65, provider: 'gemini' },
  { id: 'gemini-1.5-pro',        input: 0.00125,   output: 0.00500,  quality: 0.85, provider: 'gemini' },
  { id: 'gemini-1.5-pro-vision', input: 0.00125,   output: 0.00500,  quality: 0.85, provider: 'gemini' },
  // OpenAI family
  { id: 'gpt-4o-mini',           input: 0.00015,   output: 0.00060,  quality: 0.70, provider: 'openai' },
  { id: 'gpt-4o',                input: 0.0025,    output: 0.010,    quality: 0.92, provider: 'openai' }
]

export function getCatalog() {
  return DEFAULT_CATALOG
}

/**
 * Pick the best model.
 *   pickModel({ feature: 'chat' | 'embedding' | 'vision' | 'image_caption', minQuality = 0.5, preferCheapWithin = 0.10, expectedOutputTokens = 200, catalog })
 *
 * For 'embedding' the router narrows the catalog to models known to support
 * embeddings (currently just gemini-embedding-2 / text-embedding-3-small).
 */
export function pickModel({
  feature = 'chat',
  minQuality = 0.5,
  preferCheapWithin = 0.10,
  expectedOutputTokens = 200,
  catalog = DEFAULT_CATALOG
} = {}) {
  const pool = filterCatalogByFeature(catalog, feature)
  if (pool.length === 0) return { model: null, reason: 'no_candidates' }

  const eligible = pool.filter(m => m.quality >= minQuality)
  if (eligible.length === 0) {
    return { model: bestOf(pool), reason: 'no_meets_min_quality', considered: pool.length }
  }

  // Among eligible, prefer the cheapest one whose quality is within
  // `preferCheapWithin` of the highest-quality eligible.
  eligible.sort((a, b) => effectiveCost(a, expectedOutputTokens) - effectiveCost(b, expectedOutputTokens))
  const highest = eligible.reduce((a, b) => (b.quality > a.quality ? b : a))
  const within = eligible.find(m => (highest.quality - m.quality) <= preferCheapWithin)
  const chosen = within || eligible[0]
  return {
    model: chosen.id,
    provider: chosen.provider,
    quality: chosen.quality,
    costPerCall: Number(effectiveCost(chosen, expectedOutputTokens).toFixed(6)),
    considered: eligible.length
  }
}

function filterCatalogByFeature(catalog, feature) {
  if (feature === 'embedding') {
    return catalog.filter(m => /embedding/i.test(m.id) || /embedding/i.test(m.provider))
  }
  if (feature === 'vision' || feature === 'image_caption') {
    return catalog.filter(m => /vision|gpt-4o|gemini-1\.5-pro/i.test(m.id))
  }
  return catalog
}

function bestOf(arr) {
  if (!arr.length) return null
  return arr.reduce((a, b) => (effectiveCost(a, 200) <= effectiveCost(b, 200) ? a : b))
}

function effectiveCost(model, expectedOutputTokens = 200) {
  // Assume 1:3 input:output ratio for chat; for embeddings the caller
  // passes 0 output tokens.
  const inputCost = (model.input || 0) * 0.333
  const outputCost = (model.output || 0) * (expectedOutputTokens / 1000)
  return inputCost + outputCost
}