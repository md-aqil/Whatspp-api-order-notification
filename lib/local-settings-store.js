import { promises as fs } from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), '.data')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readStore() {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {}
    }

    throw error
  }
}

async function writeStore(store) {
  await ensureDataDir()
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(store, null, 2), 'utf8')
}

export async function getLocalIntegrationRecord() {
  const store = await readStore()
  return store.integrations || null
}

export async function saveLocalIntegrationRecord(type, data) {
  const store = await readStore()
  const existing = store.integrations || {}

  store.integrations = {
    ...existing,
    [type]: data,
    updatedAt: new Date().toISOString()
  }

  await writeStore(store)
  return store.integrations
}
