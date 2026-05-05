const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

test('Zoho lead status flow is available and unsupported WhatsApp lead capture is hidden', () => {
  const defaults = read('lib/automation-defaults.js')
  const studio = read('components/dashboard/AutomationStudio.jsx')
  const customWebhookRoute = read('app/api/webhook/custom/route.js')

  assert.match(defaults, /id: 'default-zoho-lead-status-notification'/)
  assert.match(defaults, /name: 'Zoho Lead Status Notification'/)
  assert.match(defaults, /event: 'zoho.lead_updated'/)
  assert.match(defaults, /title: 'Status changed in Zoho'/)
  assert.match(defaults, /zoho_status != empty/)
  assert.match(defaults, /Hi \{\{customer_name\}\}, your lead status is now \{\{zoho_status\}\}/)

  assert.match(studio, /value: 'zoho.lead_updated'/)
  assert.match(studio, /'zoho.lead_updated': 'default-zoho-lead-status-notification'/)
  assert.doesNotMatch(defaults, /default-send-lead-to-zoho/)
  assert.doesNotMatch(defaults, /whatsapp\.lead_captured/)
  assert.doesNotMatch(defaults, /Lead captured in WhatsApp/)
  assert.doesNotMatch(studio, /Lead Captured \(WhatsApp\)/)
  assert.doesNotMatch(studio, /whatsapp\.lead_captured/)

  assert.match(customWebhookRoute, /eventType\.startsWith\('whatsapp\.'\)/)
  assert.match(customWebhookRoute, /step\.type === 'http_request'/)
  assert.match(customWebhookRoute, /executeAutomationHttpRequest/)
})
