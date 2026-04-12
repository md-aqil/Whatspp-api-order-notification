const mysql = require('mysql2/promise');

const localUrl = 'mysql://root:@localhost:3306/whatsapp_api';

async function checkData() {
  const connection = await mysql.createConnection(localUrl);
  try {
    const [tables] = await connection.execute('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);
    console.log('Tables:', tableNames);
    
    for (const table of tableNames) {
      const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`Table ${table}: ${rows[0].count} rows`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkData();
