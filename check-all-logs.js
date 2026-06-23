import { queryMany } from './lib/mysql.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const webhooks = await queryMany("SELECT * FROM webhook_logs WHERE createdAt >= CURDATE() AND type='whatsapp'");
  webhooks.forEach(w => {
    console.log("ID:", w.id);
    console.log("Time:", w.receivedAt);
    console.log("Payload:", JSON.stringify(w.payload, null, 2));
  });
  
  process.exit(0);
}

check();
