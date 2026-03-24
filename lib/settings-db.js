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
