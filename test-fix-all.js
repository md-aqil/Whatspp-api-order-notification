import { queryOne, getPool } from './lib/mysql.js';

async function run() {
  const source = await queryOne("SELECT steps FROM automations WHERE id = 'default-zoho-lead' AND userId = 'f44ad86c-7811-4bcc-829b-1edecf0c5a0c'");
  if (!source) {
    console.log("Source not found");
    return process.exit(1);
  }
  
  const stepsStr = typeof source.steps === 'string' ? source.steps : JSON.stringify(source.steps);
  
  const pool = getPool();
  await pool.query("UPDATE automations SET steps = ? WHERE name = 'Zoho Lead Notification'", [stepsStr]);
  console.log("Updated all Zoho Lead Notification automations to use the template.");
  
  process.exit(0);
}
run();
