import { queryMany } from './lib/mysql.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const execs = await queryMany("SELECT * FROM automation_execution_logs WHERE createdAt >= CURDATE()");
  console.log("Executions today:", execs.length);
  execs.forEach(e => {
    console.log("Exec ID:", e.id, "Status:", e.status, "Error:", e.error);
  });
  process.exit(0);
}
check();
