import { Pool } from 'pg'

let pool

export function getPool() {
  if (pool) return pool

  const connectionString = process.env.DATABASE_URL || process.env.DB_URL
  if (connectionString) {
    pool = new Pool({ connectionString })
    return pool
  }

  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'whatsapp_api',
    user: process.env.DB_USER || 'mdaqil',
    password: process.env.DB_PASSWORD || ''
  })

  return pool
}

export async function query(sql, params = []) {
  return getPool().query(sql, params)
}

export async function queryOne(sql, params = []) {
  const result = await query(sql, params)
  return result.rows[0] || null
}

export async function queryMany(sql, params = []) {
  const result = await query(sql, params)
  return result.rows
}
