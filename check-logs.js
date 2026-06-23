import { queryMany } from './lib/mysql.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  console.log("=== Recent Webhook Logs ===");
  const webhooks = await queryMany("SELECT * FROM webhook_logs WHERE type='whatsapp' OR topic LIKE '%whatsapp%' ORDER BY createdAt DESC LIMIT 5");
  console.log(webhooks.map(w => ({ id: w.id, topic: w.topic, receivedAt: w.receivedAt, payload: typeof w.payload === 'string' ? w.payload.substring(0, 100) : w.payload })));

  console.log("\n=== Recent Automation Execution Logs ===");
  const execs = await queryMany("SELECT * FROM automation_execution_logs ORDER BY createdAt DESC LIMIT 5");
  console.log(execs.map(e => ({ id: e.id, stepType: e.stepType, status: e.status, error: e.error, createdAt: e.createdAt })));
  
  process.exit(0);
}

check();
