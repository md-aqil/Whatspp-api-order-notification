import { queryMany } from './lib/mysql.js';

async function run() {
  const automations = await queryMany('SELECT id, userId, name, status, updatedAt FROM automations WHERE steps LIKE "%vibeship_lead_confirmation%" ORDER BY updatedAt DESC LIMIT 5');
  console.log(automations);
  process.exit(0);
}
run();
