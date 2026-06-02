import { queryOne } from './lib/mysql.js';

async function run() {
  const automation = await queryOne('SELECT * FROM automations WHERE id = "automation_p4bzt71a5"');
  console.log(JSON.stringify(automation, null, 2));
  process.exit(0);
}
run();
