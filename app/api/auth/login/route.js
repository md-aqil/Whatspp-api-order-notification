import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken, createSession, verifyToken } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Find user by email
    const [rows] = await query('SELECT * FROM users WHERE email = ?', [email])
    const user = rows[0]

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Account is disabled' }, { status: 403 })
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Generate tokens
    const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role, plan: user.plan })
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role })

    // Store refresh token in session
    await createSession(user.id, refreshToken)

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan }
    })

    // Set cookies
    response.cookies.set('access_token', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 }) // 1 hour
    response.cookies.set('refresh_token', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 }) // 7 days

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
