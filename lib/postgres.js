import mysql from 'mysql2/promise'

let pool
export function getPool() {
  if (globalThis.mysqlPool) return globalThis.mysqlPool

  let newPool
  const connectionString = process.env.DATABASE_URL || process.env.DB_URL
  if (connectionString) {
    newPool = mysql.createPool(connectionString)
  } else {
    newPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      database: process.env.DB_NAME || 'whatsapp_api',
      user: process.env.DB_USER || 'mdaqil',
      password: process.env.DB_PASSWORD || ''
    })
  }

  globalThis.mysqlPool = newPool
  return newPool
}

export async function query(sql, params = []) {
  return getPool().query(sql, params)
}

export async function queryOne(sql, params = []) {
  const [rows] = await query(sql, params)
  return rows[0] || null
}

export async function queryMany(sql, params = []) {
  const [rows] = await query(sql, params)
  return rows
}
