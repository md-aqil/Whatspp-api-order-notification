import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { verifyToken } from '@/lib/auth'

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

    const { userId, isActive } = await request.json()
    
    if (!userId || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    await query('UPDATE users SET isActive = ? WHERE id = ?', [isActive ? 1 : 0, userId])

    return NextResponse.json({ success: true, isActive })
  } catch (error) {
    console.error('Update status error:', error)
    return NextResponse.json({ error: 'Failed to update user status' }, { status: 500 })
  }
}
