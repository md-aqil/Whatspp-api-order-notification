const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET;

const dbUrl = process.env.DATABASE_URL || process.env.DB_URL;
const poolConfig = {
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};
const pool = dbUrl
  ? mysql.createPool({ uri: dbUrl, ...poolConfig })
  : mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      database: process.env.DB_NAME || 'whatsapp_api',
      user: process.env.DB_USER || 'mdaqil',
      password: process.env.DB_PASSWORD || 'your_secure_password',
      ...poolConfig
    });

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, plan: user.plan },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

function verifyToken(token, isRefresh = false) {
  const secret = isRefresh ? REFRESH_TOKEN_SECRET : JWT_SECRET;
  return jwt.verify(token, secret);
}

async function createSession(userId, token) {
  const id = crypto.randomUUID();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.execute(
    'INSERT INTO sessions (id, userId, token_hash, expiresAt) VALUES (?, ?, ?, ?)',
    [id, userId, tokenHash, expiresAt]
  );

  return { id, userId, expiresAt };
}

async function getUserSessions(userId) {
  const [rows] = await pool.execute(
    'SELECT id, userId, expiresAt, createdAt FROM sessions WHERE userId = ? AND expiresAt > NOW()',
    [userId]
  );
  return rows;
}

async function deleteSession(sessionId) {
  await pool.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

async function deleteSessionByToken(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
}

async function deleteUserSessions(userId) {
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
