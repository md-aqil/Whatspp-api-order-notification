import { queryMany } from './lib/mysql.js';
import { decrypt } from './lib/encryption.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    const rows = await queryMany(`SELECT userId, whatsapp FROM integrations WHERE whatsapp IS NOT NULL AND whatsapp != 'null' ORDER BY updatedAt DESC LIMIT 10`);
    if (!rows.length) return console.log("No integrations");
    
    let whatsapp;
    for (const row of rows) {
      try {
        let whatsappStr = row.whatsapp;
        if (typeof whatsappStr === 'string' && whatsappStr.includes(':')) {
          whatsappStr = decrypt(whatsappStr);
        }
        whatsapp = typeof whatsappStr === 'string' ? JSON.parse(whatsappStr) : whatsappStr;
        if (whatsapp && whatsapp.accessToken) {
          console.log("Found valid token for user", row.userId);
          break;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!whatsapp || !whatsapp.accessToken) {
      console.log("No valid access token found");
      return process.exit(0);
    }

    console.log("Business ID:", whatsapp.businessAccountId);

    const response = await fetch(
      `https://graph.facebook.com/v22.0/${whatsapp.businessAccountId}/message_templates?limit=1000`,
      {
        headers: {
          'Authorization': `Bearer ${whatsapp.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    console.log("Response status:", response.status);
    if (!response.ok) {
      console.log("Error:", JSON.stringify(data, null, 2));
    } else {
      console.log("Templates found:", data.data?.length || 0);
      const approved = data.data?.filter(t => String(t.status || '').toUpperCase() === 'APPROVED') || [];
      console.log("Approved templates:", approved.length);
      console.log(JSON.stringify(approved.map(t => ({ name: t.name, status: t.status })), null, 2));
    }

  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
