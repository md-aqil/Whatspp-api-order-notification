import { NextResponse } from 'next/server'
import { queryMany } from '@/lib/mysql'
import { tuneReorderDaysForProduct } from '@/lib/reorder/reorder-tracker'

/**
 * POST /api/reorder/tune
 *   body: { userId?, productIds?: string[] }   (omit productIds to scan all)
 *
 * Re-tunes reorderDays for each product based on observed median
 * reorder cadence. Returns the proposed changes without committing if
 * `?dryRun=true`.
 */
export async function POST(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const dryRun = url.searchParams.get('dryRun') === 'true'

    let body = {}
    try { body = await request.json() } catch (e) {}
    const productIds = Array.isArray(body.productIds) && body.productIds.length > 0
      ? body.productIds
      : (await queryMany(
          `SELECT DISTINCT shopifyProductId AS productId
           FROM customer_product_preferences
           WHERE userId = ? AND reorderDays > 0`,
          [userId]
        )).map(r => r.productId)

    const results = []
    for (const productId of productIds) {
      if (dryRun) {
        const { queryOne } = await import('@/lib/mysql')
        const current = await queryOne(
          `SELECT reorderDays FROM customer_product_preferences
           WHERE userId = ? AND shopifyProductId = ?
           ORDER BY updatedAt DESC LIMIT 1`,
          [userId, productId]
        )
        results.push({ productId, current: Number(current?.reorderDays || 0) })
        continue
      }
      const result = await tuneReorderDaysForProduct({ userId, shopifyProductId: productId })
      results.push({ productId, ...result })
    }

    const updated = results.filter(r => r.updated).length
    return NextResponse.json({ success: true, scanned: results.length, updated, results, dryRun })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  return POST(request)
}