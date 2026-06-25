import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const adminAccessToken = request.cookies.get('admin_access_token')?.value
    if (!adminAccessToken) {
      return NextResponse.json({ error: 'No admin token found to return to' }, { status: 400 })
    }

    const response = NextResponse.json({ success: true })

    // Restore the admin access token and clear the temporary impersonation cookies
    response.cookies.set('access_token', adminAccessToken, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 })
    
    // We don't restore refresh_token because we don't have it saved, but access_token is enough
    // We just clear the impersonated refresh_token and admin_access_token
    response.cookies.delete('refresh_token')
    response.cookies.delete('admin_access_token')

    return response
  } catch (error) {
    console.error('Unimpersonate error:', error)
    return NextResponse.json({ error: 'Failed to unimpersonate' }, { status: 500 })
  }
}
