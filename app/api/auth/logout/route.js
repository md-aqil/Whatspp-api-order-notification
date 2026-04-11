import { NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth'

export async function POST(request) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value
    if (refreshToken) {
      await deleteSession(refreshToken)
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
