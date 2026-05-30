import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { queryMany } from './lib/mysql.js';
async function run() {
  const rows = await queryMany("SELECT name, status, steps FROM automations");
  console.log(JSON.stringify(rows.filter(r => r.name.toLowerCase().includes('zoho')), null, 2));
  process.exit(0);
}
run();
