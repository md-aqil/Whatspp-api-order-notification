const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

test('Zoho lead sync flow maps WhatsApp leads into CRM fields', () => {
  const defaults = read('lib/automation-defaults.js')
  const studio = read('components/dashboard/AutomationStudio.jsx')
  const engine = read('lib/automation-engine.js')
  const zohoApi = read('lib/zoho-api.js')
  const chatRepository = read('lib/db/chat-repository.js')
  const automationRepository = read('lib/db/automation-repository.js')

  assert.match(defaults, /id: 'default-send-whatsapp-lead-to-zoho'/)
  assert.match(defaults, /event: 'whatsapp.message_received'/)
  assert.match(defaults, /action: 'upsert_lead'/)
  assert.match(defaults, /Last_Name/)
  assert.match(defaults, /Company/)
  assert.match(defaults, /WhatsApp_Number/)
  assert.match(defaults, /Lead_Source/)
  assert.match(defaults, /Lead_Status/)
  assert.match(defaults, /Bot_Status/)
  assert.match(defaults, /First_Message_At/)
  assert.match(defaults, /Last_Inbound_Message_At/)
  assert.match(defaults, /Project_Brief_Summary/)
  assert.match(defaults, /Chatflow_Contact_ID/)
  assert.match(defaults, /Chatflow_Conversation_ID/)
  assert.match(defaults, /Human_Handover_Required/)
  assert.match(defaults, /Service_Interest_Primary/)
  assert.match(defaults, /Budget_Range/)
  assert.match(defaults, /Timeline/)

  assert.match(engine, /action === 'upsert_lead'/)
  assert.match(engine, /buildZohoLeadPayload/)
  assert.match(engine, /'ourname'/)
  assert.match(engine, /Last_Name/)
  assert.match(engine, /Company/)
  assert.match(engine, /WhatsApp_Number/)
  assert.match(engine, /Human_Handover_Required/)

  assert.match(zohoApi, /async upsertLead\(payload/)
  assert.match(zohoApi, /async findLeadByPhone\(phone\)/)
  assert.match(zohoApi, /this\.request\('POST', '\/Leads'/)
  assert.match(zohoApi, /this\.request\('PUT', '\/Leads'/)

  assert.match(chatRepository, /chatflow_contact_id/)
  assert.match(chatRepository, /chatflow_conversation_id/)
  assert.match(automationRepository, /import \{ defaultAutomations \} from '..\/automation-defaults'/)
  assert.match(automationRepository, /for \(const automation of defaultAutomations\)/)
})

test('Zoho lead status flow remains available', () => {
  const defaults = read('lib/automation-defaults.js')
  const studio = read('components/dashboard/AutomationStudio.jsx')
  const customWebhookRoute = read('app/api/webhook/custom/route.js')
  const engine = read('lib/automation-engine.js')

  assert.match(defaults, /id: 'default-zoho-lead-status-notification'/)
  assert.match(defaults, /name: 'Zoho Lead Status Notification'/)
  assert.match(defaults, /event: 'zoho.lead_updated'/)
  assert.match(defaults, /title: 'Status changed in Zoho'/)
  assert.match(defaults, /zoho_status != empty/)
  assert.match(defaults, /your lead status in Zoho has been updated to/)

  assert.match(studio, /value: 'zoho.lead_updated'/)
  assert.match(studio, /'zoho.lead_updated': 'default-zoho-lead-status-notification'/)
  assert.doesNotMatch(studio, /Lead Captured \(WhatsApp\)/)

  assert.match(customWebhookRoute, /eventType\.startsWith\('whatsapp\.'\)/)
  assert.match(customWebhookRoute, /step\.type === 'http_request'/)
  assert.match(customWebhookRoute, /executeAutomationHttpRequest/)

  assert.match(engine, /hasRecentInboundWhatsAppMessage/)
  assert.match(engine, /outside the 24-hour WhatsApp customer service window/)
  assert.match(engine, /break/)
})

test('Zoho live feed distinguishes GET verification from POST updates', () => {
  const zohoWebhook = read('lib/webhooks/zoho.js')
  const settings = read('app/dashboard/settings/page.js')

  assert.match(zohoWebhook, /const webhookTopic = request\.method === 'GET' \? 'crm_get' : 'crm_post'/)
  assert.match(zohoWebhook, /insertWebhookLog\('zoho', webhookTopic, body\)/)

  assert.match(settings, /setZohoWebhooks\(zohoLogs\.slice\(0, 2\)\)/)
  assert.match(settings, /formatZohoWebhookTopic/)
  assert.match(settings, /CRM GET/)
  assert.match(settings, /CRM POST/)
})
