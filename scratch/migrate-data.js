const mysql = require('mysql2/promise');

const localUrl = 'mysql://root:@localhost:3306/whatsapp_api';
const railwayUrl = 'mysql://root:TVHOZgjBgkFqsGIzCHhkXRcFtRBRwMAG@junction.proxy.rlwy.net:40816/railway';

const tablesToMigrate = [
  'users',
  'integrations',
  'automations',
  'chats',
  'messages',
  'orders',
  'sessions',
  'automation_conversation_state',
  'registered_webhooks',
  'wordpress_connections'
];

async function migrateData() {
  const localConn = await mysql.createConnection(localUrl);
  const railwayConn = await mysql.createConnection(railwayUrl);

  try {
    console.log('Connected to both databases');

    for (const table of tablesToMigrate) {
      console.log(`\nMigrating table: ${table}`);
      
      // Get data from local
      const [rows] = await localConn.execute(`SELECT * FROM ${table}`);
      console.log(`Found ${rows.length} rows in local ${table}`);

      if (rows.length === 0) continue;

      // Get columns for the table to build the query, excluding generated ones
      const [columns] = await railwayConn.execute(`SHOW FULL COLUMNS FROM ${table}`);
      const colNames = columns
        .filter(c => !c.Extra.includes('GENERATED') && !c.Extra.includes('VIRTUAL'))
        .map(c => c.Field);

      // Build the INSERT query
      // Using INSERT IGNORE to avoid duplicate key errors if some data already exists
      const placeholders = colNames.map(() => '?').join(', ');
      const query = `INSERT IGNORE INTO ${table} (${colNames.join(', ')}) VALUES (${placeholders})`;

      let migratedCount = 0;
      for (const row of rows) {
        const values = colNames.map(col => {
          let val = row[col];
          if (val === undefined) return null; // Convert undefined to null for MySQL
          // Handle JSON fields (must be stringified for MySQL)
          if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });

        const [result] = await railwayConn.execute(query, values);
        if (result.affectedRows > 0) {
          migratedCount++;
        }
      }

      console.log(`✅ Migrated ${migratedCount} new rows to Railway ${table}`);
    }

    console.log('\nMigration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await localConn.end();
    await railwayConn.end();
  }
}

migrateData();
