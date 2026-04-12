const mysql = require('mysql2/promise');

const railwayUrl = 'mysql://root:TVHOZgjBgkFqsGIzCHhkXRcFtRBRwMAG@junction.proxy.rlwy.net:40816/railway';

async function checkRailwayData() {
  const connection = await mysql.createConnection(railwayUrl);
  try {
    const [tables] = await connection.execute('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);
    console.log('Railway Tables:', tableNames);
    
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

checkRailwayData();
