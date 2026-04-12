import { NextResponse } from 'next/server'
import { deleteSessionByToken } from '@/lib/auth'

export async function POST(request) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value
    if (refreshToken) {
      await deleteSessionByToken(refreshToken)
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set('access_token', '', { httpOnly: true, maxAge: 0 })
    response.cookies.set('refresh_token', '', { httpOnly: true, maxAge: 0 })
    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
