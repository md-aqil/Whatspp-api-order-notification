import { createHash } from 'node:crypto'
import { defaultAutomations } from './automation-defaults.js'

export function getDefaultsFingerprint() {
  const hash = createHash('sha256')
  for (const a of defaultAutomations) {
    hash.update(a.id)
    hash.update('|')
    hash.update(String(a.steps?.length || 0))
    hash.update('|')
    for (const s of a.steps || []) hash.update(`${s.type},`)
    hash.update('||')
  }
  return hash.digest('hex').slice(0, 16)
}
