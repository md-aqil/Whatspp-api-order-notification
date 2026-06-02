import { queryOne } from './lib/mysql.js';

async function run() {
  const automation = await queryOne('SELECT steps FROM automations WHERE id = "default-zoho-lead" AND userId = "6fbc547a-4a0b-4a6e-a152-92893348a8da"');
  if (automation) {
    const steps = JSON.parse(automation.steps);
    const msgStep = steps.find(s => s.type === 'message');
    console.log('Template:', msgStep?.template);
    console.log('Message:', msgStep?.message);
  } else {
    console.log('Not found');
  }
  process.exit(0);
}
run();
