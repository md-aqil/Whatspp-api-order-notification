const mysql = require('mysql2/promise');

const connectionString = process.env.DATABASE_URL || process.env.DB_URL;
const poolConfig = {
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
}
const pool = connectionString 
  ? mysql.createPool({ uri: connectionString, ...poolConfig })
  : mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      database: process.env.DB_NAME || 'whatsapp_api',
      user: process.env.DB_USER || 'mdaqil',
      password: process.env.DB_PASSWORD || 'your_secure_password',
      ...poolConfig
    });

async function setupTables() {
  const connection = await pool.getConnection();

  try {
    console.log('Connected to MySQL database');

    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role ENUM('owner', 'admin', 'member', 'viewer') DEFAULT 'member',
        plan VARCHAR(50) DEFAULT 'free',
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_email (email),
        INDEX idx_user_role (role)
      )
    `);
    console.log('Created users table');

    // Create sessions table for JWT refresh tokens
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expiresAt TIMESTAMP NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_sessions (userId),
        INDEX idx_session_expiry (expiresAt)
      )
    `);
    console.log('Created sessions table');

    // Create API keys table for programmatic access
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        key_hash VARCHAR(255) NOT NULL,
        lastUsedAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_api_key_user (userId)
      )
    `);
    console.log('Created api_keys table');

    // Create integrations table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS integrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        whatsapp JSON,
        shopify JSON,
        stripe JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Created integrations table');

    // Create messages table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        campaignId VARCHAR(255),
        recipient VARCHAR(255),
        phone VARCHAR(255),
        message TEXT,
        isCustomer BOOLEAN,
        timestamp TIMESTAMP NULL,
        whatsappMessageId VARCHAR(255),
        status VARCHAR(255),
        messageType VARCHAR(255),
        products JSON,
        template VARCHAR(255),
        orderId VARCHAR(255),
        sentAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created messages table');

    // Create chats table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        phone VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        lastMessage TEXT,
        timestamp TIMESTAMP NULL,
        unread INT DEFAULT 0,
        avatar TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created chats table');

    // Create orders table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        shopifyOrderId VARCHAR(255),
        orderNumber VARCHAR(255),
        customerName VARCHAR(255),
        customerEmail VARCHAR(255),
        customerPhone VARCHAR(255),
        total VARCHAR(255),
        currency VARCHAR(255),
        status VARCHAR(255),
        lineItems JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        whatsappSent BOOLEAN DEFAULT FALSE,
        whatsappMessageId VARCHAR(255),
        whatsappSentAt TIMESTAMP NULL
      )
    `);
    console.log('Created orders table');

    // Create campaigns table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        name VARCHAR(255),
        template VARCHAR(255),
        templateLanguage VARCHAR(255),
        templateCategory VARCHAR(255),
        campaignType VARCHAR(255) DEFAULT 'template',
        productIds JSON,
        message TEXT,
        variables JSON,
        audience VARCHAR(255),
        recipients JSON,
        status VARCHAR(255),
        results JSON,
        sentAt TIMESTAMP NULL,
        failedAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created campaigns table');
    
    // Add columns if they don't exist (MySQL compatible)
    try { await connection.execute(`ALTER TABLE campaigns ADD COLUMN template VARCHAR(255)`); } catch (e) { /* ignore if exists */ }
    try { await connection.execute(`ALTER TABLE campaigns ADD COLUMN templateLanguage VARCHAR(255)`); } catch (e) { /* ignore if exists */ }
    try { await connection.execute(`ALTER TABLE campaigns ADD COLUMN templateCategory VARCHAR(255)`); } catch (e) { /* ignore if exists */ }
    try { await connection.execute(`ALTER TABLE campaigns ADD COLUMN campaignType VARCHAR(255) DEFAULT 'template'`); } catch (e) { /* ignore if exists */ }
    try { await connection.execute(`ALTER TABLE campaigns ADD COLUMN productIds JSON`); } catch (e) { /* ignore if exists */ }
    try { await connection.execute(`ALTER TABLE campaigns ADD COLUMN variables JSON`); } catch (e) { /* ignore if exists */ }
    console.log('Ensured campaigns.template column');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS automations (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        name VARCHAR(255),
        status BOOLEAN DEFAULT FALSE,
        source VARCHAR(255),
        summary TEXT,
        steps JSON,
        triggerEvent VARCHAR(100) GENERATED ALWAYS AS (
          JSON_UNQUOTE(JSON_EXTRACT(steps, '$[0].event'))
        ) STORED,
        metrics JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_trigger_event (triggerEvent),
        INDEX idx_automation_status (userId, status, triggerEvent)
      )
    `);
    console.log('Created automations table');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS automation_jobs (
        id VARCHAR(255) PRIMARY KEY,
        automationId VARCHAR(255) NOT NULL,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        recipient VARCHAR(255),
        message TEXT,
        template VARCHAR(255),
        payload JSON,
        status VARCHAR(255) DEFAULT 'pending',
        runAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processedAt TIMESTAMP NULL
      )
    `);
    console.log('Created automation_jobs table');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS automation_conversation_state (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        automationId VARCHAR(255) NOT NULL,
        recipient VARCHAR(255) NOT NULL,
        state VARCHAR(255),
        lastInboundAt TIMESTAMP NULL,
        lastMenuSentAt TIMESTAMP NULL,
        lastReplyKey VARCHAR(255),
        lastReplyAt TIMESTAMP NULL,
        handoffUntil TIMESTAMP NULL,
        payload JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    try {
      await connection.execute(`
        CREATE INDEX automation_conversation_state_lookup_idx
        ON automation_conversation_state (userId, automationId, recipient)
      `);
    } catch (e) { /* ignore if exists */ }
    console.log('Created automation_conversation_state table');

    // Create products table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        products JSON,
        lastSync TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Created products table');

    // Create webhooks table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        type VARCHAR(255),
        webhooks JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created webhooks table');

    // Create registered_webhooks table for user-added target URLs
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS registered_webhooks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        name VARCHAR(255) NOT NULL,
        target_url TEXT NOT NULL,
        event_types JSON,
        secret_key VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Created registered_webhooks table');

    // Create wordpress_connections table for per-user WordPress site connections
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS wordpress_connections (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        site_id VARCHAR(255) NOT NULL,
        site_name VARCHAR(255),
        site_url TEXT NOT NULL,
        webhook_secret VARCHAR(255),
        status VARCHAR(255) NOT NULL DEFAULT 'pending',
        plugin_version VARCHAR(255),
        capabilities JSON,
        metadata JSON,
        lastSeenAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    try {
      await connection.execute(`
        CREATE UNIQUE INDEX wordpress_connections_user_site_id_idx
        ON wordpress_connections (userId, site_id)
      `);
    } catch (e) { /* ignore if exists */ }
    try {
      await connection.execute(`
        CREATE UNIQUE INDEX wordpress_connections_user_site_url_idx
        ON wordpress_connections (userId, site_url(255))
      `);
    } catch (e) { /* ignore if exists */ }
    console.log('Created wordpress_connections table');

    // Create webhook_logs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(255),
        topic VARCHAR(255),
        payload JSON,
        receivedAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created webhook_logs table');

    // Create cart recovery sessions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS cart_recovery_sessions (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        platform VARCHAR(255) NOT NULL,
        connection_id VARCHAR(255),
        site_id VARCHAR(255),
        external_cart_id VARCHAR(255) NOT NULL,
        checkout_token VARCHAR(255),
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),
        customer_phone VARCHAR(255),
        cart_total VARCHAR(255),
        currency VARCHAR(255),
        cart_item_count INT DEFAULT 0,
        line_items JSON,
        checkout_url TEXT,
        discount_code VARCHAR(255),
        discount_amount VARCHAR(255),
        status VARCHAR(255) NOT NULL DEFAULT 'active',
        recovered_order_id VARCHAR(255),
        metadata JSON,
        last_activity_at TIMESTAMP NULL,
        abandoned_at TIMESTAMP NULL,
        recovered_at TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    try {
      await connection.execute(`
        CREATE UNIQUE INDEX cart_recovery_sessions_user_platform_external_idx
        ON cart_recovery_sessions (userId, platform, external_cart_id)
      `);
    } catch (e) { /* ignore if exists */ }
    try {
      await connection.execute(`
        CREATE INDEX cart_recovery_sessions_user_status_abandoned_idx
        ON cart_recovery_sessions (userId, status, abandoned_at)
      `);
    } catch (e) { /* ignore if exists */ }
    try {
      await connection.execute(`
        CREATE INDEX cart_recovery_sessions_user_phone_idx
        ON cart_recovery_sessions (userId, customer_phone)
      `);
    } catch (e) { /* ignore if exists */ }
    console.log('Created cart_recovery_sessions table');

    // Create shopify_customers table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS shopify_customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customerId VARCHAR(255) NOT NULL,
        phone VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Created shopify_customers table');

    console.log('\n✅ All tables created successfully!');

  } catch (error) {
    console.error('Error setting up tables:', error);
    throw error;
  } finally {
    connection.release();
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
