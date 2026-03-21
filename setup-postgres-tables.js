const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_api',
  user: process.env.DB_USER || 'mdaqil',
  password: process.env.DB_PASSWORD || 'your_secure_password',
});

async function setupTables() {
  const client = await pool.connect();
  
  try {
    console.log('Connected to PostgreSQL database');
    
    // Create integrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS integrations (
        id SERIAL PRIMARY KEY,
        "userId" TEXT NOT NULL DEFAULT 'default',
        whatsapp JSONB,
        shopify JSONB,
        stripe JSONB,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created integrations table');

    // Create messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL DEFAULT 'default',
        "campaignId" TEXT,
        recipient TEXT,
        phone TEXT,
        message TEXT,
        "isCustomer" BOOLEAN,
        timestamp TIMESTAMP,
        "whatsappMessageId" TEXT,
        status TEXT,
        "messageType" TEXT,
        products JSONB,
        template TEXT,
        "orderId" TEXT,
        "sentAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created messages table');

    // Create chats table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL DEFAULT 'default',
        phone TEXT NOT NULL,
        name TEXT,
        "lastMessage" TEXT,
        timestamp TIMESTAMP,
        unread INTEGER DEFAULT 0,
        avatar TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created chats table');

    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL DEFAULT 'default',
        "shopifyOrderId" TEXT,
        "orderNumber" TEXT,
        "customerName" TEXT,
        "customerEmail" TEXT,
        "customerPhone" TEXT,
        total TEXT,
        currency TEXT,
        status TEXT,
        "lineItems" JSONB,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        "whatsappSent" BOOLEAN DEFAULT FALSE,
        "whatsappMessageId" TEXT,
        "whatsappSentAt" TIMESTAMP
      )
    `);
    console.log('Created orders table');

    // Create campaigns table
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL DEFAULT 'default',
        name TEXT,
        template TEXT,
        "templateLanguage" TEXT,
        "templateCategory" TEXT,
        "campaignType" TEXT DEFAULT 'template',
        "productIds" JSONB DEFAULT '[]'::jsonb,
        message TEXT,
        variables JSONB DEFAULT '[]'::jsonb,
        audience TEXT,
        recipients JSONB,
        status TEXT,
        results JSONB,
        "sentAt" TIMESTAMP,
        "failedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created campaigns table');
    await client.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template TEXT`);
    await client.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "templateLanguage" TEXT`);
    await client.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "templateCategory" TEXT`);
    await client.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "campaignType" TEXT DEFAULT 'template'`);
    await client.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "productIds" JSONB DEFAULT '[]'::jsonb`);
    await client.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '[]'::jsonb`);
    console.log('Ensured campaigns.template column');

    await client.query(`
      CREATE TABLE IF NOT EXISTS automations (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL DEFAULT 'default',
        name TEXT,
        status BOOLEAN DEFAULT FALSE,
        source TEXT,
        summary TEXT,
        steps JSONB,
        metrics JSONB,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created automations table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS automation_jobs (
        id TEXT PRIMARY KEY,
        "automationId" TEXT NOT NULL,
        "userId" TEXT NOT NULL DEFAULT 'default',
        recipient TEXT,
        message TEXT,
        template TEXT,
        payload JSONB,
        status TEXT DEFAULT 'pending',
        "runAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "processedAt" TIMESTAMP
      )
    `);
    console.log('Created automation_jobs table');

    // Create products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        "userId" TEXT NOT NULL DEFAULT 'default',
        products JSONB,
        "lastSync" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created products table');

    // Create webhooks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id SERIAL PRIMARY KEY,
        "userId" TEXT NOT NULL DEFAULT 'default',
        type TEXT,
        webhooks JSONB,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created webhooks table');

    // Create webhook_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id TEXT PRIMARY KEY,
        type TEXT,
        topic TEXT,
        payload JSONB,
        "receivedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created webhook_logs table');

    // Create shopify_customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shopify_customers (
        id SERIAL PRIMARY KEY,
        "customerId" TEXT NOT NULL,
        phone TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created shopify_customers table');

    console.log('\n✅ All tables created successfully!');
    
  } catch (error) {
    console.error('Error setting up tables:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

setupTables()
  .then(() => {
    console.log('Database setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });
