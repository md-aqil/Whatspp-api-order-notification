import { query, queryOne } from "../mysql";

/**
 * Ensures the instagram_outbound_messages table exists in the database.
 */
export async function ensureInstagramOutboundMessagesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS instagram_outbound_messages (
      messageId VARCHAR(512) NOT NULL,
      userId VARCHAR(255) NOT NULL DEFAULT 'default',
      instagramAccountId VARCHAR(255) NULL,
      recipientId VARCHAR(255) NULL,
      text TEXT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (messageId),
      INDEX idx_instagram_outbound_user (userId),
      INDEX idx_instagram_outbound_account (instagramAccountId)
    )
  `);
}

/**
 * Saves an outbound Instagram message to the database.
 * @param {object} params - The message parameters.
 * @param {string} params.messageId - The ID of the message.
 * @param {string} [params.userId="default"] - The ID of the user who sent the message.
 * @param {string|null} [params.instagramAccountId=null] - The ID of the Instagram account.
 * @param {string|null} [params.recipientId=null] - The ID of the recipient.
 * @param {string} [params.text=""] - The text of the message.
 */
export async function saveInstagramOutboundMessage({
  messageId,
  userId = "default",
  instagramAccountId = null,
  recipientId = null,
  text = "",
}) {
  if (!messageId) return;
  await ensureInstagramOutboundMessagesTable();
  await query(
    `INSERT INTO instagram_outbound_messages
       (messageId, userId, instagramAccountId, recipientId, text, createdAt)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       userId = VALUES(userId),
       instagramAccountId = VALUES(instagramAccountId),
       recipientId = VALUES(recipientId),
       text = VALUES(text)`,
    [
      String(messageId),
      String(userId || "default"),
      instagramAccountId || null,
      recipientId || null,
      text || "",
    ],
  );
}

/**
 * Checks if a message ID belongs to a known outbound message.
 * @param {string} messageId - The ID of the message to check.
 * @returns {Promise<boolean>} - True if the message is known, false otherwise.
 */
export async function isKnownInstagramOutboundMessage(messageId) {
  if (!messageId) return false;
  try {
    await ensureInstagramOutboundMessagesTable();
    const row = await queryOne(
      "SELECT messageId FROM instagram_outbound_messages WHERE messageId = ? LIMIT 1",
      [String(messageId)],
    );
    return Boolean(row);
  } catch (error) {
    console.warn(
      "[Instagram DB] Failed to check outbound message id:",
      error.message,
    );
    throw error;
  }
}
