import initializeDatabase from '../lib/db-init.js'

// Run the database initialization
initializeDatabase().then(() => {
  console.log('Database initialized successfully')
  process.exit(0)
}).catch((error) => {
  console.error('Failed to initialize database:', error)
  process.exit(1)
})