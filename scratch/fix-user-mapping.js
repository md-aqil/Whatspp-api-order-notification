const mysql = require('mysql2/promise');

const railwayUrl = 'mysql://root:TVHOZgjBgkFqsGIzCHhkXRcFtRBRwMAG@junction.proxy.rlwy.net:40816/railway';
const activeUserId = 'b888639e-df1d-46ef-ad80-b3a80b865a31';

async function fixUserMapping() {
  const connection = await mysql.createConnection(railwayUrl);
  try {
    console.log('Connected to Railway database');

    // 1. Update messages
    const [msgRes] = await connection.execute(
      'UPDATE messages SET userId = ? WHERE userId != ?',
      [activeUserId, activeUserId]
    );
    console.log(`Updated ${msgRes.affectedRows} messages to active userId.`);

    // 2. Update chats
    const [chatRes] = await connection.execute(
      'UPDATE chats SET userId = ? WHERE userId != ?',
      [activeUserId, activeUserId]
    );
    console.log(`Updated ${chatRes.affectedRows} chats to active userId.`);

    // 3. Update integrations - remove duplicates and point to active user
    // First, delete other integrations with the same phoneId
    const [intDelRes] = await connection.execute(
      'DELETE FROM integrations WHERE userId != ? AND JSON_UNQUOTE(JSON_EXTRACT(whatsapp, "$.phoneNumberId")) = "1031070273429171"',
      [activeUserId]
    );
    console.log(`Deleted ${intDelRes.affectedRows} duplicate integrations.`);

    // Ensure the active user's integration exists (it should, but just in case)
    const [intCheck] = await connection.execute(
      'SELECT id FROM integrations WHERE userId = ?',
      [activeUserId]
    );
    if (intCheck.length === 0) {
      console.log('Active user integration missing, needs manual setup or re-linking.');
    }

    // 4. Update automations
    const [autoRes] = await connection.execute(
      'UPDATE automations SET userId = ? WHERE userId != ?',
      [activeUserId, activeUserId]
    );
    console.log(`Updated ${autoRes.affectedRows} automations to active userId.`);

    console.log('Mapping fix complete!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

fixUserMapping();
