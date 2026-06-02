import { queryMany } from './lib/mysql.js';

async function run() {
  const users = await queryMany('SELECT userId FROM integrations WHERE whatsapp IS NOT NULL');
  console.log('Users with WA integration:', users);
  
  const zohoUsers = await queryMany('SELECT userId, count(*) as count FROM automations WHERE name LIKE "%Zoho%" GROUP BY userId');
  console.log('Users with Zoho automation:', zohoUsers);
  
  process.exit(0);
}
run();
