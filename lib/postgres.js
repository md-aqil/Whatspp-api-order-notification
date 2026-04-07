import mysql from 'mysql2/promise'

let pool
export function getPool() {
  if (globalThis.mysqlPool) return globalThis.mysqlPool

  let newPool
  const connectionString = process.env.DATABASE_URL || process.env.DB_URL
  
  const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'whatsapp_api',
    user: process.env.DB_USER || 'mdaqil',
    password: process.env.DB_PASSWORD || ''
  }

  if (connectionString && typeof connectionString === 'string' && connectionString.includes('://')) {
    try {
      newPool = mysql.createPool({
        uri: connectionString,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      })
    } catch (error) {
      console.error("Invalid DATABASE_URL format, falling back to individual DB_* varibles", error.message)
      newPool = mysql.createPool({ ...poolConfig, waitForConnections: true, connectionLimit: 10, queueLimit: 0 })
    }
  } else {
    newPool = mysql.createPool({ ...poolConfig, waitForConnections: true, connectionLimit: 10, queueLimit: 0 })
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
