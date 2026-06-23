import { query } from '../lib/mysql.js';

async function migrate() {
    try {
        console.log("Migrating knowledge_base table: adding embedding column");
        const [columns] = await query("SHOW COLUMNS FROM knowledge_base LIKE 'embedding'");
        if (!columns || columns.length === 0) {
            await query("ALTER TABLE knowledge_base ADD COLUMN embedding JSON AFTER content");
            console.log("Successfully added embedding column to knowledge_base.");
        } else {
            console.log("Column 'embedding' already exists in knowledge_base.");
        }
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
