import { getPool, query, queryOne, queryMany } from '../mysql';
import { defaultAutomations } from '../automation-defaults'

export async function ensureAutomationsTable() {
  const [tableCheck] = await query("SHOW TABLES LIKE 'automations'")
  if (tableCheck.length === 0) {
    await query(`
      CREATE TABLE IF NOT EXISTS automations (
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        id VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        status BOOLEAN DEFAULT FALSE,
        source VARCHAR(255),
        summary TEXT,
        steps JSON,
        metrics JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (userId, id)
      )
    `)
  }
}

export async function getAutomationsForUser(userId) {
  await ensureAutomationsTable()
  return queryMany(
    'SELECT * FROM automations WHERE userId = ? ORDER BY updatedAt DESC',
    [userId]
  )
}

export async function getAutomationById(userId, automationId) {
  await ensureAutomationsTable()
  return queryOne(
    'SELECT * FROM automations WHERE userId = ? AND id = ?',
    [userId, automationId]
  )
}

export async function upsertAutomation(userId, automation) {
  await ensureAutomationsTable()
  const { id, name, status, source, summary, steps, metrics } = automation
  return query(
    `INSERT INTO automations (userId, id, name, status, source, summary, steps, metrics, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE 
       name = VALUES(name), 
       status = VALUES(status), 
       source = VALUES(source), 
       summary = VALUES(summary), 
       steps = VALUES(steps), 
       metrics = VALUES(metrics),
       updatedAt = NOW()`,
    [
      userId, id, name, status ? 1 : 0, source || 'System', summary || '',
      JSON.stringify(steps || []), JSON.stringify(metrics || { sent: 0, openRate: 0, conversions: 0 })
    ]
  )
}
export async function seedDefaultAutomationsForUser(userId) {
  try {
    const existing = await queryMany('SELECT id, status FROM automations WHERE userId = ?', [userId])
    const existingIds = new Set((existing || []).map(a => String(a.id)))
    
    let seededCount = 0
    for (const automation of defaultAutomations) {
      if (!existingIds.has(String(automation.id))) {
        console.log(`[Automation DB] Seeding missing default automation ${automation.id} for user ${userId}...`)
        await upsertAutomation(userId, automation)
        seededCount++
      }
    }
    
    if (seededCount > 0) {
      console.log(`[Automation DB] Successfully seeded ${seededCount} new default automations for user ${userId}.`)
    }
  } catch (err) {
    console.error(`[Automation DB] Failed to seed defaults for ${userId}:`, err.message)
  }
}
