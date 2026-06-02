import { queryMany } from './lib/mysql.js';

async function run() {
  try {
    const messages = await queryMany(`
      SELECT * FROM messages 
      WHERE phone = '917210901264' 
      ORDER BY timestamp DESC LIMIT 5
    `);
    console.log(messages);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
