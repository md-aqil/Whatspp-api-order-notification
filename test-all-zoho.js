import { queryMany } from './lib/mysql.js';

async function run() {
  const automations = await queryMany('SELECT id, userId, name, status FROM automations WHERE name LIKE "%Zoho%"');
  console.log(automations);
  process.exit(0);
}
run();
