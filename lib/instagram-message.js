export function buildInstagramMessagePayload(
  recipientId,
  text,
  pdfUrl = null,
  options = {},
) {
  const recipient = options.commentId
    ? { comment_id: options.commentId }
    : { id: recipientId };
  const message = pdfUrl
    ? {
        attachment: {
          type: "file",
          payload: {
            url: pdfUrl,
            is_reusable: true,
          },
        },
      }
    : { text };

  return {
    messaging_type: "RESPONSE",
    recipient,
    message,
  };
}

export function getInstagramSendUrls(options = {}) {
  const urls = ["https://graph.facebook.com/v22.0/me/messages"];
  if (options.instagramAccountId) {
    urls.push(
      `https://graph.instagram.com/v22.0/${options.instagramAccountId}/messages`,
    );
  }
  return urls;
}
