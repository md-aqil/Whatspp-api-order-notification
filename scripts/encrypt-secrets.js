import { query, getPool } from '../lib/mysql.js';
import { encrypt, decrypt } from '../lib/encryption.js';

async function migrate() {
  const pool = getPool();
  if (!pool) {
    console.error('Database connection failed.');
    process.exit(1);
  }

  console.log('--- Starting Secret Encryption Migration ---');

  // 1. Migrate integrations table
  const [integrations] = await pool.execute('SELECT id, whatsapp, shopify, stripe FROM integrations');
  console.log(`Found ${integrations.length} integration records.`);

  for (const row of integrations) {
    let changed = false;
    const whatsapp = typeof row.whatsapp === 'string' ? JSON.parse(row.whatsapp) : row.whatsapp;
    const shopify = typeof row.shopify === 'string' ? JSON.parse(row.shopify) : row.shopify;
    const stripe = typeof row.stripe === 'string' ? JSON.parse(row.stripe) : row.stripe;

    if (whatsapp?.accessToken && !whatsapp.accessToken.includes(':')) {
      whatsapp.accessToken = encrypt(whatsapp.accessToken);
      changed = true;
    }
    if (shopify?.clientSecret && !shopify.clientSecret.includes(':')) {
      shopify.clientSecret = encrypt(shopify.clientSecret);
      changed = true;
    }
    if (stripe?.secretKey && !stripe.secretKey.includes(':')) {
      stripe.secretKey = encrypt(stripe.secretKey);
      changed = true;
    }

    if (changed) {
      await pool.execute(
        'UPDATE integrations SET whatsapp = ?, shopify = ?, stripe = ? WHERE id = ?',
        [JSON.stringify(whatsapp), JSON.stringify(shopify), JSON.stringify(stripe), row.id]
      );
      console.log(`Updated integration ID: ${row.id}`);
    }
  }

  // 2. Migrate whatsapp_accounts table
  const [accounts] = await pool.execute('SELECT id, accessToken FROM whatsapp_accounts');
  console.log(`Found ${accounts.length} WhatsApp account records.`);

  for (const account of accounts) {
    if (account.accessToken && !account.accessToken.includes(':')) {
      const encrypted = encrypt(account.accessToken);
      await pool.execute(
        'UPDATE whatsapp_accounts SET accessToken = ? WHERE id = ?',
        [encrypted, account.id]
      );
      console.log(`Updated WhatsApp account ID: ${account.id}`);
    }
  }

  console.log('--- Migration Complete ---');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
