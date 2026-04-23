const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';

// Lazy loading for environment variables to ensure they are available
function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.warn('[Auth] JWT_SECRET is not defined, using fallback. Please set JWT_SECRET in .env');
    return 'fallback-secret-for-dev-only';
  }
  return secret;
}

function getRefreshTokenSecret() {
  return process.env.REFRESH_TOKEN_SECRET || getJwtSecret();
}

let mysqlPool;
function getPool() {
  if (mysqlPool) return mysqlPool;

  const dbUrl = process.env.DATABASE_URL || process.env.DB_URL;
  const poolConfig = {
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  };

  console.log('[Auth] Initializing database pool...');
  
  if (dbUrl) {
    console.log('[Auth] Using DATABASE_URL connection string');
    mysqlPool = mysql.createPool({ uri: dbUrl, ...poolConfig });
  } else {
    console.log('[Auth] Using individual DB environment variables');
    mysqlPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      database: process.env.DB_NAME || 'whatsapp_api',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      ...poolConfig
    });
  }

  return mysqlPool;
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateAccessToken(user) {
  const secret = getJwtSecret();
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, plan: user.plan },
    secret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken(user) {
  const secret = getRefreshTokenSecret();
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    secret,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

function verifyToken(token, isRefresh = false) {
  const secret = isRefresh ? getRefreshTokenSecret() : getJwtSecret();
  return jwt.verify(token, secret);
}

async function createSession(userId, token) {
  const id = crypto.randomUUID();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const pool = getPool();
  await pool.execute(
    'INSERT INTO sessions (id, userId, token_hash, expiresAt) VALUES (?, ?, ?, ?)',
    [id, userId, tokenHash, expiresAt]
  );

  return { id, userId, expiresAt };
}

async function getUserSessions(userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT id, userId, expiresAt, createdAt FROM sessions WHERE userId = ? AND expiresAt > NOW()',
    [userId]
  );
  return rows;
}

async function deleteSession(sessionId) {
  const pool = getPool();
  await pool.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

async function deleteSessionByToken(token) {
  const pool = getPool();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
}

async function deleteUserSessions(userId) {
  const pool = getPool();
  await pool.execute('DELETE FROM sessions WHERE userId = ?', [userId]);
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  createSession,
  getUserSessions,
  deleteSession,
  deleteSessionByToken,
  deleteUserSessions
};
