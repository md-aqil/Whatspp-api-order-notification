const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkState() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM automation_conversation_state WHERE recipient = ?',
      ['917210562014']
    );
    console.log('Current State:', JSON.stringify(rows, null, 2));
    
    if (rows.length > 0) {
      const automationId = rows[0].automationId;
      const [autoRows] = await connection.execute(
        'SELECT steps FROM automations WHERE id = ?',
        [automationId]
      );
      if (autoRows.length > 0) {
        console.log('Automation Steps:', autoRows[0].steps);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkState();
