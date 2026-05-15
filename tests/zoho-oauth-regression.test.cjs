const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

test('Zoho OAuth callback persists tokens under the zoho integration for the authenticated user', () => {
  const source = read('app/api/[[...path]]/route.js')

  assert.match(source, /await saveStoredIntegration\(\s*'zoho',\s*\{/)
  assert.match(source, /expiryTime: Date\.now\(\) \+ \(tokens\.expires_in \* 1000\)[\s\S]*\},\s*zohoUserId\s*\)/)
  assert.doesNotMatch(source, /saveStoredIntegration\(currentUserId,\s*'zoho'/)
})

test('Zoho OAuth uses signed state to bind callbacks to the initiating ChatFlow user', () => {
  const source = read('app/api/[[...path]]/route.js')

  assert.match(source, /function createZohoOAuthState\(userId\)/)
  assert.match(source, /function verifyZohoOAuthState\(state\)/)
  assert.match(source, /const authenticatedUserId = requireRequestUserId\(request\)/)
  assert.match(source, /authParams\.set\('state', createZohoOAuthState\(authenticatedUserId\)\)/)
  assert.match(source, /zohoUserId = verifyZohoOAuthState\(state\)/)
  assert.match(source, /error=zoho_invalid_state/)
})

test('Zoho settings explains CRM org and API Console logo blockers', () => {
  const source = read('app/dashboard/settings/page.js')

  assert.match(source, /crm\.zoho\.in/)
  assert.match(source, /api-console\.zoho\.in/)
  assert.match(source, /Zoho CRM organization/)
  assert.match(source, /app logo/)
})
