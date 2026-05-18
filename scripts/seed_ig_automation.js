// Run this script via `node scripts/seed_ig_automation.js`
// It will iterate over all distinct userIds in the automations table and ensure the default Instagram comment growth automation is present.

const { queryMany } = require('../lib/mysql'); // generic query helper
const { seedDefaultAutomationsForUser } = require('../lib/db/automation-repository');

async function getAllUserIds() {
  const rows = await queryMany('SELECT DISTINCT userId FROM automations');
  return rows.map(r => r.userId);
}

async function main() {
  try {
    const userIds = await getAllUserIds();
    console.log('Seeding default automations for users:', userIds);
    for (const uid of userIds) {
      await seedDefaultAutomationsForUser(uid);
    }
    console.log('Seeding completed.');
  } catch (err) {
    console.error('Error during seeding:', err);
    process.exit(1);
  }
}

main();
