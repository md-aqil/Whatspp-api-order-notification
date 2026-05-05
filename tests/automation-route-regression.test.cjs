const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

test('automation PUT route uses defined table and pool helpers', () => {
  const source = read('app/api/[[...path]]/route.js')
  const putBlock = source.match(/if \(route === '\/automations' && method === 'PUT'\) \{[\s\S]*?if \(route === '\/automations' && method === 'GET'\)/)?.[0] || ''

  assert.match(putBlock, /await ensureAutomationsTable\(\)/)
  assert.match(putBlock, /const connection = await getPool\(\)\.getConnection\(\)/)
  assert.doesNotMatch(putBlock, /ensureAutomationJobsTable/)
  assert.doesNotMatch(putBlock, /ensureKnowledgeBaseTable/)
  assert.doesNotMatch(putBlock, /getMysqlPool/)
})
