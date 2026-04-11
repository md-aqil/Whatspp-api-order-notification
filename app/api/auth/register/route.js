import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { hashPassword, generateAccessToken, generateRefreshToken, createSession } from '@/lib/auth'
import crypto from 'crypto'

export async function POST(request) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Check if user exists
    const [existing] = await query('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // Hash password
    const passwordHash = await hashPassword(password)
    const userId = crypto.randomUUID()

    // Create user
    await query(
      'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      [userId, email, passwordHash, name || email.split('@')[0], 'owner']
    )

    // Generate tokens
    const accessToken = generateAccessToken({ id: userId, email, role: 'owner', plan: 'free' })
    const refreshToken = generateRefreshToken({ id: userId, email, role: 'owner' })

    // Store refresh token
    await createSession(userId, refreshToken)

    const response = NextResponse.json({
      success: true,
      user: { id: userId, email, name: name || email.split('@')[0], role: 'owner', plan: 'free' }
    })

    response.cookies.set('access_token', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 })
    response.cookies.set('refresh_token', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 })

    return response
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
