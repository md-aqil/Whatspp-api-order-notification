import { getPool, query, queryOne, queryMany } from '../mysql';
import { defaultAutomations } from '../automation-defaults'

let isAutomationsTableChecked = false;

export async function ensureAutomationsTable() {
  if (isAutomationsTableChecked) return;

  try {
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
      isAutomationsTableChecked = true;
      return
    }

    const [primaryKeys] = await query("SHOW KEYS FROM automations WHERE Key_name = 'PRIMARY'")
    const hasUserScopedPrimaryKey = Array.isArray(primaryKeys) &&
      primaryKeys.some(key => key.Column_name === 'userId') &&
      primaryKeys.some(key => key.Column_name === 'id')

    if (!hasUserScopedPrimaryKey) {
      await query('ALTER TABLE automations DROP PRIMARY KEY, ADD PRIMARY KEY (userId, id)')
    }
    isAutomationsTableChecked = true;
  } catch (error) {
    console.warn('[Automation DB] Failed to verify user-scoped primary key:', error.message)
    // Mark as checked so we don't spam errors on every request
    isAutomationsTableChecked = true;
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
    const existing = await queryMany('SELECT id, status FROM automations WHERE userId = ? LIMIT 20', [userId])
    if (existing && existing.length >= defaultAutomations.length) {
      return // Already fully seeded
    }

    const existingIds = new Set((existing || []).map(a => String(a.id)))
    
    let seededCount = 0
    for (const automation of defaultAutomations) {
      if (!existingIds.has(String(automation.id))) {
        await upsertAutomation(userId, automation)
        seededCount++
      }
    }
    
    if (seededCount > 0) {
      console.log(`[Automation DB] Seeded ${seededCount} default automations for ${userId}.`)
    }
  } catch (err) {
    console.error(`[Automation DB] Failed to seed defaults for ${userId}:`, err.message)
  }
}
