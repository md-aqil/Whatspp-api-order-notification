import { getPool } from './mysql'

/**
 * Very simple Redis-less rate limiter using MySQL
 * In a real production environment, use Redis (e.g., Upstash)
 */
export async function checkRateLimit(key, limit, windowSeconds) {
  const pool = getPool()
  if (!pool) return { success: true } // Fail open if no DB

  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - windowSeconds

  try {
    // Clean up old entries
    await pool.execute(
      `DELETE FROM rate_limits WHERE createdAt < FROM_UNIXTIME(?)`,
      [windowStart]
    )

    // Count recent entries
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as count FROM rate_limits WHERE rateKey = ? AND createdAt >= FROM_UNIXTIME(?)`,
      [key, windowStart]
    )

    const count = rows[0].count

    if (count >= limit) {
      return { success: false, count, limit, retryAfter: windowSeconds }
    }

    // Add new entry
    await pool.execute(
      `INSERT INTO rate_limits (rateKey) VALUES (?)`,
      [key]
    )

    return { success: true, count: count + 1, limit }
  } catch (error) {
    console.error('Rate limiter error:', error.message)
    return { success: true } // Fail open
  }
}
