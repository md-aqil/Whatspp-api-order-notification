import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/mysql'
import { checkOutboundThrottle } from '@/lib/outbound-throttle'
import { requireRequestUserId } from '@/lib/request-user'

/**
 * GET /api/admin/throttle?userId=...&phone=...
 *   → returns the current per-tenant + per-recipient counter and the
 *     decision for the proposed (phone, userId) send.
 */
export async function GET(request) {
  try {
    const userId = requireRequestUserId(request)
    const url = new URL(request.url)
    const phone = url.searchParams.get('phone') || null

    const perTenantMinute = await queryOne(
      `SELECT COUNT(*) AS cnt FROM outbound_throttle
       WHERE userId = ? AND bucketStart = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i')`,
      [userId]
    ).catch(() => ({ cnt: 0 }))
    const perTenantHour = await queryOne(
      `SELECT COUNT(*) AS cnt FROM outbound_throttle
       WHERE userId = ? AND bucketStart >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [userId]
    ).catch(() => ({ cnt: 0 }))
    const perRecipientHour = phone
      ? await queryOne(
          `SELECT COUNT(*) AS cnt FROM outbound_throttle
           WHERE userId = ? AND phone = ? AND bucketStart >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
          [userId, String(phone).replace(/\D/g, '')]
        ).catch(() => ({ cnt: 0 }))
      : { cnt: 0 }

    const decision = await checkOutboundThrottle({ userId, phone })

    return NextResponse.json({
      success: true,
      userId,
      phone: phone ? String(phone).replace(/\D/g, '') : null,
      current: {
        tenantPerMinute: Number(perTenantMinute?.cnt || 0),
        tenantPerHour: Number(perTenantHour?.cnt || 0),
        recipientPerHour: Number(perRecipientHour?.cnt || 0)
      },
      decision
    })
  } catch (err) {
    if (err.status === 401) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}