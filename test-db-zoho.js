import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { queryMany } from './lib/mysql.js';
async function run() {
  const allIntegrations = await queryMany("SELECT userId, zoho FROM integrations");
  console.log("All integrations:", allIntegrations);
  process.exit(0);
}
run();
