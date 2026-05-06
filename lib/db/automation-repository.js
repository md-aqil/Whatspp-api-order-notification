import { getPool, query, queryOne, queryMany } from '../mysql';

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
  const defaults = [
    {
      id: 'default-welcome',
      name: 'Welcome New Customers',
      status: true,
      source: 'System',
      summary: 'Sends a welcome message when a customer initiates a chat.',
      steps: [
        {
          id: 'step-1',
          type: 'message',
          payload: { text: 'Hello! Welcome to our store. How can we help you today?' }
        }
      ],
      metrics: { sent: 0, openRate: 0, conversions: 0 }
    },
    {
      id: 'default-cart-recovery',
      name: 'Abandoned Cart Recovery',
      status: true,
      source: 'System',
      summary: 'Reminds customers about items left in their cart after 1 hour.',
      steps: [
        {
          id: 'step-1',
          type: 'delay',
          payload: { delay: 3600000 } // 1 hour
        },
        {
          id: 'step-2',
          type: 'message',
          payload: { text: 'Hi {{customer_name}}, we noticed you left some items in your cart. Complete your order now and get 10% off with code SAVE10!' }
        }
      ],
      metrics: { sent: 0, openRate: 0, conversions: 0 }
    }
  ]

  for (const automation of defaults) {
    await upsertAutomation(userId, automation)
  }
}
