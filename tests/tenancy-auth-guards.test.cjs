const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

test('request-user helper exposes strict authenticated resolver', () => {
  const source = read('lib/request-user.js')

  assert.match(source, /export function requireRequestUserId\(request\)/)
  assert.match(source, /const authError = new Error\('Not authenticated'\)/)
  assert.match(source, /authError\.status = 401/)
})

test('logout revokes stored sessions by refresh token hash', () => {
  const routeSource = read('app/api/auth/logout/route.js')
  const authSource = read('lib/auth.js')

  assert.match(routeSource, /deleteSessionByToken/)
  assert.doesNotMatch(routeSource, /deleteSession\(refreshToken\)/)
  assert.match(authSource, /async function deleteSessionByToken\(token\)/)
  assert.match(authSource, /DELETE FROM sessions WHERE token_hash = \?/)
})

test('dedicated WhatsApp account route scopes writes by user and has valid insert SQL', () => {
  const source = read('app/api/whatsapp-accounts/route.js')

  assert.match(source, /SELECT id FROM whatsapp_accounts WHERE id = \? AND userId = \?/)
  assert.match(source, /UPDATE whatsapp_accounts SET[\s\S]*WHERE id = \? AND userId = \?/)
  assert.match(source, /VALUES \(\?, \?, \?, \?, \?, \?, \?, NOW\(\), NOW\(\)\)/)
})

test('catch-all WhatsApp account helper scopes writes by user', () => {
  const source = read('app/api/[[...path]]/route.js')

  assert.match(source, /SELECT id FROM whatsapp_accounts WHERE id = \? AND userId = \?/)
  assert.match(source, /UPDATE whatsapp_accounts SET[\s\S]*WHERE id = \? AND userId = \?/)
})

test('whatsapp save and send flows validate phone number ids before Graph send', () => {
  const catchAllSource = read('app/api/[[...path]]/route.js')
  const accountsSource = read('app/api/whatsapp-accounts/route.js')

  assert.match(catchAllSource, /await validateWhatsAppPhoneNumberAccess\(\s*data\.phoneNumberId,\s*data\.accessToken,\s*data\.businessAccountId/s)
  assert.match(catchAllSource, /await validateWhatsAppPhoneNumberAccess\(phoneNumberId, accessToken, businessAccountId\)/)
  assert.doesNotMatch(catchAllSource, /skipping validation/)
  assert.match(accountsSource, /await validateWhatsAppPhoneNumberAccess\(phoneNumberId, accessToken, businessAccountId\)/)
})

test('campaign routes require auth and avoid shared default tenant', () => {
  const listRoute = read('app/api/campaigns/route.js')
  const deleteRoute = read('app/api/campaigns/[id]/route.js')

  assert.match(listRoute, /requireRequestUserId/)
  assert.match(listRoute, /const userId = requireRequestUserId\(request\)/)
  assert.doesNotMatch(listRoute, /'default'/)
  assert.match(deleteRoute, /const userId = requireRequestUserId\(request\)/)
  assert.match(deleteRoute, /DELETE FROM campaigns WHERE id = \? AND userId = \?/)
})

test('registered webhook routes derive tenant from auth and scope mutations by userId', () => {
  const source = read('app/api/webhooks/registered/route.js')

  assert.match(source, /requireRequestUserId/)
  assert.match(source, /const userId = requireRequestUserId\(request\)/)
  assert.doesNotMatch(source, /url\.searchParams\.get\('userId'\)/)
  assert.doesNotMatch(source, /userId = 'default'/)
  assert.match(source, /DELETE FROM registered_webhooks WHERE id = \? AND userId = \?/)
  assert.match(source, /UPDATE registered_webhooks SET \$\{updates\.join\(', '\)\} WHERE id = \? AND userId = \?/)
  assert.match(source, /SELECT \* FROM registered_webhooks WHERE id = \? AND userId = \?/)
})

test('integration storage uses the authenticated tenant and backfills legacy default settings', () => {
  const source = read('app/api/[[...path]]/route.js')

  assert.match(source, /async function getStoredIntegrations\(userId = 'default'\)/)
  assert.match(source, /const normalizedUserId = String\(userId \|\| 'default'\)/)
  assert.match(source, /const legacyDefaultRow = await readIntegrationRow\('default'\)/)
  assert.match(source, /await backfillUserScopedIntegrations\(parsedLegacy\)/)
  assert.match(source, /integrations = await getStoredIntegrations\(currentUserId\)/)
  assert.match(source, /await saveStoredIntegration\(type, data, currentUserId\)/)
  assert.doesNotMatch(source, /saveStoredIntegration\(type, data\)(?!,)/)
})

test('automation storage uses tenant-scoped keys and atomic saves', () => {
  const source = read('app/api/[[...path]]/route.js')

  assert.match(source, /PRIMARY KEY \(userId, id\)/)
  assert.match(source, /ALTER TABLE automations DROP PRIMARY KEY, ADD PRIMARY KEY \(userId, id\)/)
  assert.match(source, /const connection = await getMysqlPool\(\)\.getConnection\(\)/)
  assert.match(source, /await connection\.beginTransaction\(\)/)
  assert.match(source, /await connection\.commit\(\)/)
  assert.match(source, /await connection\.rollback\(\)/)
  assert.match(source, /DELETE FROM automations[\s\S]*AND id NOT IN \(\$\{placeholders\}\)/)
})
