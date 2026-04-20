const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Basic .env parser
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
  }
}

async function promoteUser() {
  loadEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }

  const pool = mysql.createPool({ uri: connectionString });
  try {
    const [rows] = await pool.execute('SELECT email FROM users LIMIT 1');
    if (rows.length === 0) {
      console.log('No users found in database.');
      return;
    }

    const email = rows[0].email;
    console.log(`Promoting user: ${email}`);
    
    await pool.execute('UPDATE users SET role = ? WHERE email = ?', ['superadmin', email]);
    console.log('Successfully promoted user to superadmin.');
  } catch (error) {
    console.error('Error promoting user:', error);
  } finally {
    await pool.end();
  }
}

promoteUser();
