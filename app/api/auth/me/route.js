import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { verifyToken } from '@/lib/auth'

export async function GET(request) {
  try {
    const accessToken = request.cookies.get('access_token')?.value
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const payload = verifyToken(accessToken)
    if (!payload || !payload.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const [rows] = await query('SELECT id, email, name, role, plan, isActive FROM users WHERE id = ?', [payload.id])
    const user = rows[0]

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'User not found or disabled' }, { status: 401 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }
}
