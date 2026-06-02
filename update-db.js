import { query, queryMany } from './lib/mysql.js';

async function run() {
  try {
    const automations = await queryMany(`
      SELECT id, userId, name, status, steps 
      FROM automations 
      WHERE name = 'Zoho Lead Notification' AND userId = 'f44ad86c-7811-4bcc-829b-1edecf0c5a0c'
    `);
    
    for (const automation of automations) {
      let steps = typeof automation.steps === 'string' ? JSON.parse(automation.steps) : automation.steps;
      let updated = false;

      for (let step of steps) {
        if (step.id === 'step-message-zoho-1' && step.type === 'message') {
          step.template = 'vibeship_lead_confirmation';
          step.templateName = 'vibeship_lead_confirmation';
          step.templateLanguage = 'en_US';
          updated = true;
          console.log('Updated step:', step.id);
        }
      }

      if (updated) {
        await query(
          'UPDATE automations SET steps = ? WHERE id = ? AND userId = ?',
          [JSON.stringify(steps), automation.id, automation.userId]
        );
        console.log('Successfully updated automation ' + automation.id + ' in live database.');
      }
    }
  } catch (err) {
    console.error('Error updating DB:', err);
  }
  process.exit(0);
}

run();
