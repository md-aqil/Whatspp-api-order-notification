import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const execFileAsync = promisify(execFile)

async function initializeDatabase() {
  const scriptPath = path.join(process.cwd(), 'setup-postgres-tables.js')

  try {
    await execFileAsync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      env: process.env
    })
    console.log('PostgreSQL database initialization completed successfully')
  } catch (error) {
    console.error('PostgreSQL database initialization failed:', error)
    throw error
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default initializeDatabase
