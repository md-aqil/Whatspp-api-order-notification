// OPTIONAL: Run this separately or integrate into db-init.js
// This adds the branding table to the existing database setup

import { query } from './lib/mysql.js'

async function addBrandingTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS branding (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        logoUrl VARCHAR(500),
        businessName VARCHAR(255),
        welcomeMessage TEXT,
        primaryColor VARCHAR(7) DEFAULT '#005cc0',
        fontFamily VARCHAR(255) DEFAULT 'Inter',
        position VARCHAR(20) DEFAULT 'bottom-right',
        botName VARCHAR(255) DEFAULT 'Support Bot',
        enabled BOOLEAN DEFAULT true,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE (userId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('Branding table created successfully.')
    process.exit(0)
  } catch (error) {
    console.error('Failed to create branding table:', error)
    process.exit(1)
  }
}

addBrandingTable()