import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { verifyToken, hashPassword } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

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

    const { name, email, password, role, plan } = await request.json()
    
    if (!email || !password || !role || !plan) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if user already exists
    const [existing] = await query('SELECT id FROM users WHERE email = ?', [email])
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }

    const id = uuidv4()
    const hashed = await hashPassword(password)

    await query(
      'INSERT INTO users (id, email, password_hash, name, role, plan) VALUES (?, ?, ?, ?, ?, ?)',
      [id, email, hashed, name || null, role, plan]
    )

    return NextResponse.json({ success: true, user: { id, email, name, role, plan } })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
