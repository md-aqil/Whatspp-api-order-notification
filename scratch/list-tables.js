const mysql = require('mysql2/promise');

const connectionString = 'mysql://root:TVHOZgjBgkFqsGIzCHhkXRcFtRBRwMAG@junction.proxy.rlwy.net:40816/railway';

async function listTables() {
  const connection = await mysql.createConnection(connectionString);
  try {
    const [rows] = await connection.execute('SHOW TABLES');
    console.log('Tables in database:', rows.map(r => Object.values(r)[0]));
  } catch (error) {
    console.error('Error listing tables:', error.message);
  } finally {
    await connection.end();
  }
}

listTables();
