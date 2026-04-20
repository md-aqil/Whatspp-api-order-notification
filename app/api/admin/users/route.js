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

    // Check if user is superadmin
    if (payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 })
    }

    // Fetch all users with integration counts
    const [users] = await query(`
      SELECT 
        u.id, 
        u.email, 
        u.name, 
        u.role, 
        u.plan, 
        u.isActive, 
        u.createdAt,
        (SELECT COUNT(*) FROM integrations i WHERE i.userId = u.id) as integrationCount,
        (SELECT COUNT(*) FROM wordpress_connections wc WHERE wc.userId = u.id) as wordpressCount
      FROM users u
      ORDER BY u.createdAt DESC
    `)

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Admin get users error:', error)
    if (error?.name === 'TokenExpiredError' || error?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to get users' }, { status: 500 })
  }
}
