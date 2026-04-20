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

    // Fetch all integrations joined with user email
    const [integrations] = await query(`
      SELECT 
        i.*,
        u.email as userEmail,
        u.name as userName
      FROM integrations i
      JOIN users u ON i.userId = u.id
      ORDER BY i.createdAt DESC
    `)

    // Fetch all wordpress connections joined with user email
    const [wordpress] = await query(`
      SELECT 
        wc.*,
        u.email as userEmail,
        u.name as userName
      FROM wordpress_connections wc
      JOIN users u ON wc.userId = u.id
      ORDER BY wc.createdAt DESC
    `)

    return NextResponse.json({ 
      integrations,
      wordpress
    })
  } catch (error) {
    console.error('Admin get integrations error:', error)
    if (error?.name === 'TokenExpiredError' || error?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to get integrations' }, { status: 500 })
  }
}
