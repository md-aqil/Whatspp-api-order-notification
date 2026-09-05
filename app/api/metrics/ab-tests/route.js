import { NextResponse } from 'next/server'
import { queryMany } from '@/lib/mysql'

/**
 * AB-test analytics API.
 *
 *   GET /api/metrics/ab-tests?userId=...&experimentKey=...
 *
 * For each variant returns:
 *   - assignments    (people bucketed)
 *   - sent           (sentAt IS NOT NULL)
 *   - read           (readAt IS NOT NULL)
 *   - responded      (respondedAt IS NOT NULL)
 *   - converted      (convertedAt IS NOT NULL)
 *   - convValue      (SUM(conversionValue))
 *   - rates: readRate, responseRate, conversionRate
 *   - lift vs control (percent change in conversionRate)
 */
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const experimentKey = url.searchParams.get('experimentKey') || null

    const where = ['a.userId = ?']
    const params = [userId]
    if (experimentKey) {
      where.push('a.experimentKey = ?')
      params.push(experimentKey)
    }
    const whereSql = where.join(' AND ')

    // Compute lift vs control + 2-proportion z-test for each experiment
    for (const exp of Object.keys(byKey)) {
      const variants = byKey[exp]
      const control = variants.find(v => /control/i.test(v.variant)) || variants[0]
      if (!control) continue
      const cSent = Number(control.sent || 0)
      const cConv = Number(control.converted || 0)
      for (const v of variants) {
        if (v.variant === control.variant) {
          v.lift = 0
          v.significance = { z: 0, pValue: 1, significant: false, sampleSize: cSent }
          continue
        }
        const tSent = Number(v.sent || 0)
        const tConv = Number(v.converted || 0)
        v.lift = control.conversionRate > 0
          ? Number((((v.conversionRate - control.conversionRate) / control.conversionRate) * 100).toFixed(1))
          : null
        v.significance = twoProportionZTest({
          controlSuccesses: cConv, controlTrials: cSent,
          treatmentSuccesses: tConv, treatmentTrials: tSent
        })
      }
    }

    const experiments = Object.keys(byKey).map(exp => ({
      experimentKey: exp,
      variants: byKey[exp]
    }))

    return NextResponse.json({
      success: true,
      experimentKey: experimentKey || 'all',
      experiments,
      note: 'Use `?experimentKey=foo` to filter. responseRate counts inbound messages after assignedAt; conversionRate counts orders.'
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

/**
 * Two-proportion z-test (two-sided). Returns:
 *   { z, pValue, significant, sampleSize }
 * where `significant` uses α = 0.05 and a power guard (needs both arms
 * with at least 30 trials).
 */
function twoProportionZTest({ controlSuccesses, controlTrials, treatmentSuccesses, treatmentTrials }) {
  const n1 = Number(controlTrials) || 0
  const n2 = Number(treatmentTrials) || 0
  const x1 = Number(controlSuccesses) || 0
  const x2 = Number(treatmentSuccesses) || 0
  if (n1 < 30 || n2 < 30) {
    return { z: 0, pValue: null, significant: false, sampleSize: n1 + n2, reason: 'insufficient_sample' }
  }
  const p1 = x1 / n1
  const p2 = x2 / n2
  const pPool = (x1 + x2) / (n1 + n2)
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2))
  if (se === 0) return { z: 0, pValue: null, significant: false, sampleSize: n1 + n2, reason: 'zero_variance' }
  const z = (p2 - p1) / se
  const pValue = 2 * (1 - normalCdf(Math.abs(z)))
  return {
    z: Number(z.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    significant: pValue < 0.05,
    sampleSize: n1 + n2
  }
}

/** Standard normal CDF via the Abramowitz & Stegun approximation. */
function normalCdf(x) {
  const a1 = 0.31938153, a2 = -0.356563782, a3 = 1.781477937, a4 = -1.821255978, a5 = 1.330274429
  const k = 1.0 / (1.0 + 0.2316419 * x)
  const w = 1.0 - normalPdf(x) * (a1 * k + a2 * k * k + a3 * Math.pow(k, 3) + a4 * Math.pow(k, 4) + a5 * Math.pow(k, 5))
  return w
}

function normalPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}
