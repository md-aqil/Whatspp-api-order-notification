const mysql = require('mysql2/promise');

async function check() {
  try {
    const conn = await mysql.createConnection('mysql://root:5nUiTR3JBIjL-.7Gx1U;@187.127.154.55:3306/whatsapp_api');
    
    console.log("Checking user team@vibeship.in");
    const [users] = await conn.query("SELECT id, email FROM users WHERE email='team@vibeship.in'");
    if (users.length === 0) {
      console.log("User not found!");
      return;
    }
    const userId = users[0].id;
    console.log("User ID:", userId);

    const [ints] = await conn.query("SELECT zoho, whatsapp FROM integrations WHERE userId = ?", [userId]);
    console.log("\nZoho Integration:", ints.length > 0 ? ints[0].zoho : "None");
    console.log("WhatsApp Integration:", ints.length > 0 ? ints[0].whatsapp : "None");

    console.log("\nChecking automation flows for user:");
    const [flows] = await conn.query("SELECT id, name, trigger_event, is_active FROM automation_flows WHERE userId = ? AND trigger_event LIKE '%zoho%'", [userId]);
    console.log(flows);

    console.log("\nChecking latest Zoho webhook logs:");
    const [webhookLogs] = await conn.query("SELECT id, type, payload, receivedAt FROM webhook_logs WHERE type='zoho' AND userId = ? ORDER BY receivedAt DESC LIMIT 3", [userId]);
    if (webhookLogs.length === 0) {
        console.log("No Zoho webhook logs found for user.");
    } else {
        for (const log of webhookLogs) {
            console.log(`[Webhook] ID: ${log.id} Time: ${log.receivedAt}`);
            console.log(JSON.stringify(log.payload, null, 2));
        }
    }
    
    await conn.end();
  } catch (e) {
    console.error("Error:", e.message);
  }
}

check();
