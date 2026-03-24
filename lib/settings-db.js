import { getPool } from '@/lib/postgres'

let settingsTablesReadyPromise

const SETTINGS_TABLE_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS integrations (
      id SERIAL PRIMARY KEY,
      "userId" TEXT NOT NULL DEFAULT 'default',
      whatsapp JSONB,
      shopify JSONB,
      stripe JSONB,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS webhooks (
      id SERIAL PRIMARY KEY,
      "userId" TEXT NOT NULL DEFAULT 'default',
      type TEXT,
      webhooks JSONB,
      "createdAt" TIMESTAMP DEFAULT NOW()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS registered_webhooks (
      id SERIAL PRIMARY KEY,
      "userId" TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL,
      target_url TEXT NOT NULL,
      event_types TEXT[] DEFAULT '{}'::text[],
      secret_key TEXT,
      is_active BOOLEAN DEFAULT true,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS wordpress_connections (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL DEFAULT 'default',
      site_id TEXT NOT NULL,
      site_name TEXT,
      site_url TEXT NOT NULL,
      webhook_secret TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      plugin_version TEXT,
      capabilities JSONB DEFAULT '{}'::jsonb,
      metadata JSONB DEFAULT '{}'::jsonb,
      "lastSeenAt" TIMESTAMP,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    )
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS wordpress_connections_user_site_id_idx
    ON wordpress_connections ("userId", site_id)
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS wordpress_connections_user_site_url_idx
    ON wordpress_connections ("userId", site_url)
  `,
  `
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id TEXT PRIMARY KEY,
      type TEXT,
      topic TEXT,
      payload JSONB,
      "receivedAt" TIMESTAMP,
      "createdAt" TIMESTAMP DEFAULT NOW()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS wa_config (
      id SERIAL PRIMARY KEY,
      "userId" VARCHAR(255) NOT NULL,
      config JSONB,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    )
  `
]

export async function ensureSettingsTables() {
  if (!settingsTablesReadyPromise) {
    settingsTablesReadyPromise = (async () => {
      const pool = getPool()

      for (const statement of SETTINGS_TABLE_STATEMENTS) {
        await pool.query(statement)
      }
    })().catch((error) => {
      settingsTablesReadyPromise = null
      throw error
    })
  }

  return settingsTablesReadyPromise
}
