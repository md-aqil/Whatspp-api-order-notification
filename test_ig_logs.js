const mysql = require('mysql2/promise');

/**
 * Checks the database for Instagram related logs and metrics.
 */
async function check() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
    });

    console.log("\nChecking latest Instagram webhook logs:");
    const [webhookLogs] = await conn.query("SELECT id, payload, receivedAt FROM webhook_logs WHERE provider='instagram' ORDER BY receivedAt DESC LIMIT 3");
    for (const log of webhookLogs) {
      console.log(`[Webhook] Time: ${log.receivedAt}`);
      console.log(JSON.stringify(log.payload, null, 2));
    }

    console.log("\nChecking recent messages sent by bot:");
    const [messages] = await conn.query("SELECT id, userId, phone, message, timestamp, status, isCustomer FROM messages WHERE isCustomer = 0 ORDER BY timestamp DESC LIMIT 5");
    console.table(messages);

    console.log("\nChecking metrics/automations:");
    const [metrics] = await conn.query("SELECT id, type, name, status, metrics FROM automations WHERE status = 1 LIMIT 5");
    console.table(metrics);

    await conn.end();
  } catch (e) {
    console.error("Error:", e.message);
  }
}

check();
