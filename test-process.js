import { processAutomationEvent } from './lib/automation-engine.js';
import { getStoredIntegrations } from './lib/db/integration-repository.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const context = {
    "email": "",
    "phone": "+917210901264",
    "customer_phone": "+917210901264",
    "source": "Zoho CRM",
    "company": "",
    "last_name": "Jha",
    "customer_name": "Test Jha",
    "first_name": "Test",
    "lead_source": "",
    "lead_status": "",
    "created_time": "02-06-2026 13:43:59"
  };
  const userId = 'f44ad86c-7811-4bcc-829b-1edecf0c5a0c';

  try {
    console.log('Fetching integrations...');
    const integrations = await getStoredIntegrations(userId);
    console.log('Simulating synchronous processing...');
    const result = await processAutomationEvent('zoho.lead_updated', context, integrations, userId);
    console.log('Processing completed. Result:', result);
  } catch (error) {
    console.error('Error processing event:', error);
  }
  process.exit(0);
}

run();
