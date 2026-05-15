import 'dotenv/config'
import { query } from '../lib/postgres.js'
import { decrypt } from '../lib/encryption.js'

async function testTemplates() {
  try {
    const [rows] = await query('SELECT userId, whatsapp FROM integrations WHERE whatsapp IS NOT NULL ORDER BY updatedAt DESC LIMIT 1')
    if (!rows || rows.length === 0) {
      console.log('No WhatsApp integration found in database.')
      return
    }

    const row = rows[0]
    let whatsappStr = row.whatsapp
    
    if (typeof whatsappStr === 'string' && whatsappStr.includes(':')) {
        whatsappStr = decrypt(whatsappStr)
    }
    
    let whatsapp = typeof whatsappStr === 'string' ? JSON.parse(whatsappStr) : whatsappStr

    console.log(`Testing with WABA ID: ${whatsapp.businessAccountId}`)
    console.log(`Phone Number ID: ${whatsapp.phoneNumberId}`)

    const response = await fetch(
      `https://graph.facebook.com/v22.0/${whatsapp.businessAccountId}/message_templates?limit=1000`,
      {
        headers: {
          Authorization: `Bearer ${whatsapp.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.log('API Error:', JSON.stringify(data, null, 2))
      return
    }

    const templates = data.data || []
    console.log(`Found ${templates.length} total templates in Meta.`)
    
    templates.forEach(t => {
      console.log(`- Name: ${t.name} | Status: ${t.status} | Category: ${t.category} | Language: ${t.language}`)
    })

  } catch (error) {
    console.error('Script Error:', error)
  }
}

testTemplates().then(() => process.exit(0))
