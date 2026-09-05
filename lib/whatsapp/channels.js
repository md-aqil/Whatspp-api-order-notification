import { buildMetaAuthHeaders } from '../meta-auth.js'

/**
 * WhatsApp Channels API helpers (GA Sep 2024).
 * Lets merchants publish rich posts to followers in the Channels tab.
 *
 * Endpoints:
 *   POST /v22.0/{channel_id}/messages    – publish a post
 *   GET  /v22.0/{channel_id}/insights    – view counts
 *
 * Gated: only fires if process.env.WHATSAPP_CHANNEL_ID is set.
 */

export function getChannelId(integrations) {
  return (
    integrations?.whatsapp?.channelId ||
    process.env.WHATSAPP_CHANNEL_ID ||
    null
  )
}

export function isChannelsEnabled(integrations) {
  return Boolean(getChannelId(integrations))
}

/**
 * Publish a channel post. Supports text, image, video, poll, document.
 *
 * @param {string} channelId
 * @param {string} accessToken
 * @param {object} post
 *   - type: 'text' | 'image' | 'video' | 'document' | 'poll'
 *   - text: string
 *   - mediaUrl: string (for image/video/document)
 *   - options: array of strings (for polls)
 */
export async function publishChannelPost(channelId, accessToken, post = {}) {
  if (!channelId || !accessToken) {
    console.log('[Channels] Skipped: no channelId/accessToken configured.')
    return null
  }
  const url = `https://graph.facebook.com/v22.0/${channelId}/messages`

  let payload
  switch (post.type) {
    case 'image':
    case 'video':
    case 'document':
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'channel',
        type: post.type,
        [post.type]: { link: post.mediaUrl, caption: post.text || '' }
      }
      break
    case 'poll':
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'channel',
        type: 'interactive',
        interactive: {
          type: 'poll',
          header: post.headerText ? { type: 'text', text: post.headerText.substring(0, 60) } : undefined,
          body: { text: post.text || '' },
          action: {
            name: 'poll',
            options: (post.options || []).slice(0, 4).map((opt, idx) => ({
              name: String(opt).substring(0, 25),
              index: idx
            })),
            multi_select: false
          }
        }
      }
      break
    case 'text':
    default:
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'channel',
        type: 'text',
        text: { body: post.text || '' }
      }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...buildMetaAuthHeaders(accessToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  if (!res.ok || data.error) {
    console.warn('[Channels] publish failed:', JSON.stringify(data.error || data))
    return null
  }
  return data.messages?.[0] || data
}

export async function getChannelInsights(channelId, accessToken) {
  if (!channelId || !accessToken) return null
  try {
    const res = await fetch(`https://graph.facebook.com/v22.0/${channelId}/insights?metric=channel_followers,channel_post_views,channel_post_reactions`, {
      headers: { ...buildMetaAuthHeaders(accessToken) }
    })
    const data = await res.json()
    if (!res.ok) return null
    return data
  } catch (err) {
    console.warn('[Channels] insights failed:', err.message)
    return null
  }
}