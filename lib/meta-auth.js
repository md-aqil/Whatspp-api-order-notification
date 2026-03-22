export function sanitizeMetaAccessToken(value = '') {
  const unwrapped = String(value || '').trim().replace(/^['"]+|['"]+$/g, '').trim()
  return unwrapped.replace(/^Bearer\s+/i, '').trim()
}

export function buildMetaAuthHeaders(accessToken, extraHeaders = {}) {
  return {
    Authorization: `Bearer ${sanitizeMetaAccessToken(accessToken)}`,
    ...extraHeaders
  }
}

export function mapMetaAccessTokenError(message = '') {
  const normalized = String(message || '').trim()
  if (/bad signature/i.test(normalized)) {
    return 'Access Token is invalid, expired, or pasted with extra text. Paste only the raw Meta access token without "Bearer " and regenerate it if needed.'
  }

  return normalized
}
