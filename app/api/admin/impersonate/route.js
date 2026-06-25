import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { verifyToken, generateAccessToken, generateRefreshToken, createSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const accessToken = request.cookies.get('access_token')?.value
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const payload = verifyToken(accessToken)
    if (!payload || !payload.id || payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 })
    }

    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Fetch target user
    const [rows] = await query('SELECT * FROM users WHERE id = ?', [userId])
    const targetUser = rows[0]

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    if (!targetUser.isActive) {
      return NextResponse.json({ error: 'Target account is disabled' }, { status: 403 })
    }

    // Generate new tokens for target user
    const targetAccessToken = generateAccessToken({ id: targetUser.id, email: targetUser.email, role: targetUser.role, plan: targetUser.plan })
    const targetRefreshToken = generateRefreshToken({ id: targetUser.id, email: targetUser.email, role: targetUser.role })

    await createSession(targetUser.id, targetRefreshToken)

    const response = NextResponse.json({ success: true })

    // Save superadmin's original token in a special cookie to allow return
    const currentAdminCookie = request.cookies.get('admin_access_token')?.value
    if (!currentAdminCookie) {
      response.cookies.set('admin_access_token', accessToken, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 60 * 60 * 24 }) // 1 day limit for impersonation
    }

    // Set new cookies for impersonated user
    response.cookies.set('access_token', targetAccessToken, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 })
    response.cookies.set('refresh_token', targetRefreshToken, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 })

    return response
  } catch (error) {
    console.error('Impersonate error:', error)
    return NextResponse.json({ error: 'Failed to impersonate' }, { status: 500 })
  }
}
