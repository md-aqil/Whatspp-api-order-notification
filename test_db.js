const mysql = require('mysql2/promise');

async function check() {
  try {
    const conn = await mysql.createConnection('mysql://root:5nUiTR3JBIjL-.7Gx1U;@187.127.154.55:3306/whatsapp_api');
    
    console.log("Connected to DB. Checking integrations for user with email team@vibeship.in...");
    const [users] = await conn.query("SELECT id, email FROM users WHERE email='team@vibeship.in'");
    if (users.length === 0) {
      console.log("User not found!");
      return;
    }
    const userId = users[0].id;
    console.log("User ID:", userId);

    console.log("\nChecking WhatsApp Integration:");
    const [ints] = await conn.query("SELECT whatsapp FROM integrations WHERE userId = ?", [userId]);
    console.log(ints.length > 0 ? ints[0].whatsapp : "No integration found.");

    console.log("\nChecking latest webhook logs:");
    const [logs] = await conn.query("SELECT id, type, receivedAt FROM webhook_logs WHERE type='whatsapp' AND userId = ? ORDER BY receivedAt DESC LIMIT 5", [userId]);
    console.log(logs);

    console.log("\nChecking latest received webhook logs for ANY user:");
    const [anyLogs] = await conn.query("SELECT id, type, userId, receivedAt FROM webhook_logs WHERE type='whatsapp' ORDER BY receivedAt DESC LIMIT 5");
    console.log(anyLogs);
    
    await conn.end();
  } catch (e) {
    console.error("Error:", e.message);
  }
}

check();
