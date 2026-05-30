import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { queryMany } from './lib/mysql.js';
async function run() {
  const zohoRows = await queryMany("SELECT userId FROM integrations WHERE zoho IS NOT NULL AND zoho != 'null'");
  console.log("Zoho integrations:", zohoRows);
  const waRows = await queryMany("SELECT userId, whatsapp FROM integrations WHERE whatsapp IS NOT NULL AND whatsapp != 'null'");
  console.log("WA integrations count:", waRows.length);
  process.exit(0);
}
run();
