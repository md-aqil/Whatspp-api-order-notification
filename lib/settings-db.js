import { getPool } from '@/lib/postgres'

let settingsTablesReadyPromise

const SETTINGS_TABLE_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS integrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId VARCHAR(255) NOT NULL DEFAULT 'default',
      whatsapp JSON,
      shopify JSON,
      stripe JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS webhooks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId VARCHAR(255) NOT NULL DEFAULT 'default',
      type VARCHAR(255),
      webhooks JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
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
  `,
  `
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
  `,
  // Index creation moved to try-catch block in ensureSettingsTables
  `
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(255),
      topic VARCHAR(255),
      payload JSON,
      receivedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS wa_config (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId VARCHAR(255) NOT NULL,
      config JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
  `
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
  `
]

// Index creation statements (MySQL doesn't support IF NOT EXISTS for indexes)
const INDEX_STATEMENTS = [
  `CREATE UNIQUE INDEX wordpress_connections_user_site_id_idx ON wordpress_connections (userId, site_id)`,
  `CREATE UNIQUE INDEX wordpress_connections_user_site_url_idx ON wordpress_connections (userId, site_url(255))`,
  `CREATE UNIQUE INDEX cart_recovery_sessions_user_platform_external_idx ON cart_recovery_sessions (userId, platform, external_cart_id)`,
  `CREATE INDEX cart_recovery_sessions_user_status_abandoned_idx ON cart_recovery_sessions (userId, status, abandoned_at)`,
  `CREATE INDEX cart_recovery_sessions_user_phone_idx ON cart_recovery_sessions (userId, customer_phone)`
]

export async function ensureSettingsTables() {
  if (!settingsTablesReadyPromise) {
    settingsTablesReadyPromise = (async () => {
      const pool = getPool()

      // Create tables first
      for (const statement of SETTINGS_TABLE_STATEMENTS) {
        await pool.query(statement)
      }

      // Create indexes (ignore errors if they already exist)
      for (const statement of INDEX_STATEMENTS) {
        try {
          await pool.query(statement)
        } catch (error) {
          // Index might already exist, ignore error
          if (!error.message.includes('Duplicate key name')) {
            console.warn('Index creation warning:', error.message)
          }
        }
      }
    })().catch((error) => {
      settingsTablesReadyPromise = null
      throw error
    })
  }

  return settingsTablesReadyPromise
}
