import { handleZohoWebhook } from './lib/webhooks/zoho.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const payload = {
    "email": "",
    "phone": "+917210901264",
    "source": "Zoho CRM",
    "company": "",
    "last_name": "Jha",
    "first_name": "Test",
    "lead_source": "",
    "lead_status": "",
    "created_time": "02-06-2026 13:43:59"
  };
  const userId = 'f44ad86c-7811-4bcc-829b-1edecf0c5a0c';

  try {
    console.log('Simulating Zoho Webhook...');
    const result = await handleZohoWebhook(payload, userId);
    console.log('Webhook processed successfully:', result);
  } catch (error) {
    console.error('Error processing webhook:', error);
  }
  process.exit(0);
}

run();
