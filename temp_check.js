const mysql = require('mysql2/promise');

async function check() {
  try {
    const conn = await mysql.createConnection('mysql://root:@localhost:3306/whatsapp_api');
    
    console.log("\nChecking latest Instagram webhook logs:");
    const [webhookLogs] = await conn.query("SELECT id, type, payload, receivedAt FROM webhook_logs WHERE type='instagram' ORDER BY receivedAt DESC LIMIT 3");
    if (webhookLogs.length === 0) {
        console.log("No Instagram webhook logs found.");
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
