import mysql from 'mysql2/promise';

let mysqlPool;

export function getMysqlPool() {
  if (globalThis.mysqlPool) return globalThis.mysqlPool;

  if (!mysqlPool) {
    const connectionString = process.env.DATABASE_URL || process.env.DB_URL;
    const poolConfig = {
      waitForConnections: true,
      connectionLimit: 20, // Increased for enterprise scale
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    };

    if (connectionString) {
      mysqlPool = mysql.createPool({ uri: connectionString, ...poolConfig });
    } else {
      mysqlPool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        database: process.env.DB_NAME || 'whatsapp_api',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        ...poolConfig
      });
    }
    globalThis.mysqlPool = mysqlPool;
  }

  return mysqlPool;
}

export async function queryOne(sql, params = []) {
  const [rows] = await getMysqlPool().execute(sql, params);
  return rows[0] || null;
}

export async function queryMany(sql, params = []) {
  const [rows] = await getMysqlPool().execute(sql, params);
  return rows;
}

export async function query(sql, params = []) {
  return getMysqlPool().execute(sql, params);
}
