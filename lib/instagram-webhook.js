/**
 * Handles a new comment on an Instagram media object.
 * @param {object} change - The change object from the webhook.
 * @param {string} instagramAccountId - The ID of the Instagram account.
 * @returns {object|null} An event object or null if the change is not a comment.
 */
function handleComment(change, instagramAccountId) {
  if (change.field !== "comments") return null;

  const commentVal = change.value;
  if (!commentVal?.id) return null;

  return {
    event: "instagram.comment_created",
    context: {
      commentId: commentVal.id,
      commentText: commentVal.text || "",
      senderId: commentVal.from?.id,
      username: commentVal.from?.username || "customer",
      mediaId: commentVal.media?.id,
      instagramAccountId,
      messageText: commentVal.text || "",
      customer_message: commentVal.text || "",
      platform: "instagram",
    },
  };
}

/**
 * Handles an edited message.
 * @param {object} messagingEvent - The messaging event from the webhook.
 * @param {object} options - Additional options.
 * @param {string} instagramAccountId - The ID of the Instagram account.
 * @returns {object|null} An event object or null if the message is not valid.
 */
function handleMessageEdit(messagingEvent, options, instagramAccountId) {
  const { messageTextByMid, senderIdByMid, usernameByMid, outboundMessageIds } = options;
  const mid = messagingEvent.message_edit.mid;
  const hydratedText = messageTextByMid[mid] || "";
  if (outboundMessageIds.has(mid)) {
    console.log(
      "[Instagram Webhook] Ignoring automation outbound message_edit:",
      mid,
    );
    return null;
  }

  if (hydratedText) {
    const senderId = senderIdByMid[mid] || messagingEvent.sender?.id;
    if (!senderId || senderId === instagramAccountId) return null;

    return {
      event: "instagram.message_received",
      context: {
        senderId,
        recipientId: messagingEvent.recipient?.id,
        instagramAccountId,
        messageId: mid,
        messageText: hydratedText,
        customer_message: hydratedText,
        username:
          usernameByMid[mid] ||
          messagingEvent.sender?.username ||
          "customer",
        timestamp: messagingEvent.timestamp || Date.now(),
        platform: "instagram",
        source: "message_edit_hydrated",
      },
    };
  }

  console.log(
    "[Instagram Webhook] Ignoring message_edit event without message text:",
    mid,
  );
  return null;
}

/**
 * Handles a new message.
 * @param {object} messagingEvent - The messaging event from the webhook.
 * @param {string} instagramAccountId - The ID of the Instagram account.
 * @returns {object|null} An event object or null if the message is not valid.
 */
function handleMessage(messagingEvent, instagramAccountId) {
  const messageText = messagingEvent.message?.text;

  if (!messagingEvent.message || typeof messageText !== "string") {
    return null;
  }

  const senderId = messagingEvent.sender?.id;
  if (!senderId || senderId === instagramAccountId) {
    console.log(
      `Ignoring echo message from Instagram account ${instagramAccountId}`,
    );
    return null;
  }

  return {
    event: "instagram.message_received",
    context: {
      senderId,
      recipientId: messagingEvent.recipient?.id,
      instagramAccountId,
      messageText,
      customer_message: messageText,
      username: messagingEvent.sender?.username || "customer",
      timestamp: messagingEvent.timestamp || Date.now(),
      platform: "instagram",
    },
  };
}

/**
 * Builds a list of automation events from an Instagram webhook payload.
 * @param {object} body - The body of the webhook request.
 * @param {object} [options={}] - Additional options.
 * @returns {object[]} An array of event objects.
 */
export function buildInstagramAutomationEvents(body = {}, options = {}) {
  const events = [];
  options.outboundMessageIds = options.outboundMessageIds || new Set();

  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    const instagramAccountId = entry.id;

    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      const event = handleComment(change, instagramAccountId);
      if (event) events.push(event);
    }

    for (const messagingEvent of Array.isArray(entry.messaging) ? entry.messaging : []) {
      let event;
      if (messagingEvent.message_edit) {
        event = handleMessageEdit(messagingEvent, options, instagramAccountId);
      } else {
        event = handleMessage(messagingEvent, instagramAccountId);
      }
      if (event) events.push(event);
    }
  }

  return events;
}
