export function buildInstagramAutomationEvents(body = {}) {
  const events = [];

  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    const instagramAccountId = entry.id;

    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      if (change.field !== "comments") continue;

      const commentVal = change.value;
      if (!commentVal?.id) continue;

      events.push({
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
      });
    }

    for (const messagingEvent of Array.isArray(entry.messaging)
      ? entry.messaging
      : []) {
      const messageText = messagingEvent.message?.text;

      if (!messagingEvent.message || typeof messageText !== "string") {
        if (messagingEvent.message_edit) {
          console.log(
            "[Instagram Webhook] Ignoring message_edit event without message text:",
            messagingEvent.message_edit.mid,
          );
        }
        continue;
      }

      const senderId = messagingEvent.sender?.id;
      if (!senderId || senderId === instagramAccountId) {
        console.log(
          `Ignoring echo message from Instagram account ${instagramAccountId}`,
        );
        continue;
      }

      events.push({
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
      });
    }
  }

  return events;
}
