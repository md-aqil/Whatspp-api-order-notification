const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config({ path: '/etc/lcsw/.env' });

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;

function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    return text;
  }
}

async function sync() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '5nUiTR3JBIjL-.7Gx1U;',
    database: 'lcsw_db'
  });

  console.log('Fetching integrations...');
  const [rows] = await connection.execute('SELECT userId, whatsapp FROM integrations');
  
  for (const row of rows) {
    if (!row.whatsapp) continue;
    
    const decrypted = decrypt(row.whatsapp);
    let data;
    try {
      data = JSON.parse(decrypted);
    } catch (e) {
      console.log(`Failed to parse JSON for user ${row.userId}`);
      continue;
    }

    if (data && data.phoneNumberId) {
      console.log(`Syncing account for user ${row.userId} with ID ${data.phoneNumberId}`);
      await connection.execute(
        `INSERT INTO whatsapp_accounts (id, userId, accountName, phoneNumberId, accessToken, businessAccountId, phoneNumber, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE userId = VALUES(userId), accountName = VALUES(accountName), accessToken = VALUES(accessToken), businessAccountId = VALUES(businessAccountId), updatedAt = NOW()`,
        [`wa_${data.phoneNumberId}`, row.userId, data.accountName || 'Primary Account', data.phoneNumberId, data.accessToken, data.businessAccountId, data.phoneNumber || '']
      );
    }
  }

  console.log('Sync complete.');
  await connection.end();
}

sync().catch(console.error);
