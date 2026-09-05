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

/**
 * Same as requireRequestUserId but additionally requires the caller's JWT
 * payload to carry `role === 'superadmin'`. Used by routes that have
 * cross-tenant side-effects (segment-send, admin/*, etc.).
 *
 * Throws an Error with `status = 401` when unauthenticated and `status = 403`
 * when authenticated but not a superadmin, so route handlers can map these
 * to the correct HTTP status code.
 */
export function requireRequestSuperadmin(request) {
  let payload = null
  try {
    payload = getRequestTokenPayload(request)
  } catch (error) {
    console.warn('[requireRequestSuperadmin] Invalid access token:', error.message)
  }
  if (!payload?.id) {
    const err = new Error('Not authenticated')
    err.status = 401
    throw err
  }
  if (payload.role !== 'superadmin') {
    const err = new Error('Forbidden: superadmin access required')
    err.status = 403
    throw err
  }
  return String(payload.id)
}
