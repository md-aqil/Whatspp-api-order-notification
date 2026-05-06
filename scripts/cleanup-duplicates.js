import { createConnection } from 'mysql2/promise';

async function cleanupDuplicates() {
  const connection = await createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'whatsapp_api'
  });

  try {
    console.log('Cleaning up duplicate chats...');
    const [chats] = await connection.execute('SELECT * FROM chats ORDER BY timestamp DESC');
    
    const seen = new Set();
    let deletedCount = 0;

    for (const chat of chats) {
      const key = `${chat.userId}-${chat.phone}`;
      if (seen.has(key)) {
        await connection.execute('DELETE FROM chats WHERE id = ?', [chat.id]);
        deletedCount++;
      } else {
        seen.add(key);
      }
    }
    console.log(`Deleted ${deletedCount} duplicate chats.`);
  } catch (err) {
    console.error('Error cleaning up:', err);
  } finally {
    await connection.end();
  }
}

cleanupDuplicates();
