import { buildMetaAuthHeaders } from '../meta-auth.js'

/**
 * Resolves a WhatsApp media id (e.g. from an inbound image/audio message) into
 * a public HTTPS URL via the Meta Graph API:
 *   1. GET /v22.0/{media_id}  → { url, mime_type, ... }
 *   2. GET <url> with auth header → the binary stream (caller fetches again)
 *
 * @param {string} mediaId  - the id from message.image.id / message.audio.id / etc.
 * @param {string} accessToken - WhatsApp access token
 * @returns {Promise<{ url: string, mime_type: string, file_size: number } | null>}
 */
export async function getWhatsAppMediaMetadata(mediaId, accessToken) {
  if (!mediaId || !accessToken) return null

  try {
    const res = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, {
      headers: { ...buildMetaAuthHeaders(accessToken) }
    })
    if (!res.ok) {
      console.warn('[WhatsApp Media] metadata fetch failed:', res.status)
      return null
    }
    const data = await res.json()
    return {
      url: data.url,
      mime_type: data.mime_type || '',
      file_size: data.file_size || 0
    }
  } catch (err) {
    console.warn('[WhatsApp Media] metadata error:', err.message)
    return null
  }
}

/**
 * Map a WhatsApp message `type` to the media id field for images / audio / video / documents.
 */
export function getMediaIdFromMessage(message) {
  if (!message || typeof message !== 'object') return null
  switch (message.type) {
    case 'image': return message.image?.id || null
    case 'audio': return message.audio?.id || null
    case 'video': return message.video?.id || null
    case 'document': return message.document?.id || null
    case 'sticker': return message.sticker?.id || null
    default: return null
  }
}

export function getMediaMimeTypeFromMessage(message) {
  if (!message) return ''
  switch (message.type) {
    case 'image': return message.image?.mime_type || 'image/jpeg'
    case 'audio': return message.audio?.mime_type || 'audio/ogg'
    case 'video': return message.video?.mime_type || 'video/mp4'
    case 'document': return message.document?.mime_type || 'application/pdf'
    default: return ''
  }
}