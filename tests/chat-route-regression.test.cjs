const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

test('catch-all chat route imports the repository function it calls', () => {
  const source = read('app/api/[[...path]]/route.js')

  assert.match(source, /getStoredChats,\s*\n\s*getStoredMessagesByPhone/)
  assert.match(source, /const chats = await getStoredChats\(authenticatedUserId\)/)
})
