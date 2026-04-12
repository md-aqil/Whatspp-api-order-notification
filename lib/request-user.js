import { verifyToken } from '@/lib/auth'

function getRequestTokenPayload(request) {
  const accessToken = request.cookies.get('access_token')?.value

  if (!accessToken) {
    return null
  }

  return verifyToken(accessToken)
}

export function resolveRequestUserId(request, explicitUserId = null) {
  try {
    const payload = getRequestTokenPayload(request)
    if (payload?.id) {
      return String(payload.id)
    }
  } catch (error) {
    console.warn('[resolveRequestUserId] Invalid access token:', error.message)
  }

  if (explicitUserId !== null && explicitUserId !== undefined && explicitUserId !== '') {
    return String(explicitUserId)
  }

  return 'default'
}

export function requireRequestUserId(request) {
  try {
    const payload = getRequestTokenPayload(request)
    if (payload?.id) {
      return String(payload.id)
    }
  } catch (error) {
    console.warn('[requireRequestUserId] Invalid access token:', error.message)
  }

  const authError = new Error('Not authenticated')
  authError.status = 401
  throw authError
}
