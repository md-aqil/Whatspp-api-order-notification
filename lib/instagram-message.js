/**
 * Builds the payload for an Instagram message.
 * @param {string} recipientId - The ID of the recipient.
 * @param {string} text - The text of the message.
 * @param {object|null} [attachment=null] - The attachment to include in the message.
 * @param {string} attachment.type - The type of the attachment (e.g., "file", "image", "video").
 * @param {string} attachment.url - The URL of the attachment.
 * @param {object} [options={}] - Additional options.
 * @param {string} [options.commentId] - The ID of the comment to reply to.
 * @returns {object} The message payload.
 */
export function buildInstagramMessagePayload(
  recipientId,
  text,
  attachment = null,
  options = {},
) {
  const recipient = options.commentId
    ? { comment_id: options.commentId }
    : { id: recipientId };
  let message;
  if (attachment && attachment.url) {
    message = {
      attachment: {
        type: attachment.type || "file",
        payload: {
          url: attachment.url,
          is_reusable: true,
        },
      },
    };
  } else {
    message = { text };
  }

  return {
    messaging_type: "RESPONSE",
    recipient,
    message,
  };
}

/**
 * Gets the URLs for sending Instagram messages.
 * @param {object} [options={}] - Additional options.
 * @param {string} [options.pageId] - The ID of the Facebook page.
 * @param {string} [options.instagramAccountId] - The ID of the Instagram account.
 * @returns {string[]} An array of URLs.
 */
export function getInstagramSendUrls(options = {}) {
  const urls = [];
  if (options.pageId) {
    urls.push(`https://graph.facebook.com/v22.0/${options.pageId}/messages`);
  }
  urls.push("https://graph.facebook.com/v22.0/me/messages");
  if (options.instagramAccountId) {
    urls.push(
      `https://graph.instagram.com/v22.0/${options.instagramAccountId}/messages`,
    );
  }
  return urls;
}
