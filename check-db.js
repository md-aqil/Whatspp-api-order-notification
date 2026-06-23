import { query } from './lib/mysql.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  try {
    const [columns] = await query("SHOW COLUMNS FROM knowledge_base");
    console.log(columns.map(c => c.Field));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
check();
