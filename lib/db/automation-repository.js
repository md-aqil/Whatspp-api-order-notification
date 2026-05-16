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
  const existing = await queryMany('SELECT id FROM automations WHERE userId = ? LIMIT 1', [userId])
  if (existing && existing.length > 0) {
    return // Don't seed if user already has automations
  }
  
  for (const automation of defaultAutomations) {
    await upsertAutomation(userId, automation)
  }
}
