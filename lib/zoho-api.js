import { httpClient } from './httpClient'
import { query, queryOne } from './mysql'
import { encrypt, decrypt } from './encryption'

/**
 * Zoho CRM API Client
 */
export class ZohoClient {
  constructor(userId, integrationData) {
    this.userId = userId
    this.data = integrationData || {}
    this.dc = this.data.dc || process.env.ZOHO_DC || 'zoho.com'
  }

  get baseUrl() {
    // this.dc is usually "zoho.com", "zoho.eu", "zoho.in"
    // The API url is "zohoapis.com", "zohoapis.eu", so we replace "zoho." with "zohoapis."
    const apiDomain = this.dc.replace('zoho.', 'zohoapis.')
    return `https://www.${apiDomain}/crm/v3`
  }

  async getAccessToken() {
    const now = Date.now()
    if (this.data.accessToken && this.data.expiresAt && now < this.data.expiresAt - 60000) {
      return this.data.accessToken
    }

    if (!this.data.refreshToken) {
      throw new Error('Zoho Refresh Token missing. Please re-authenticate.')
    }

    return this.refreshTokens()
  }

  async refreshTokens() {
    console.log(`[Zoho API] Refreshing tokens for user ${this.userId}`)
    
    const accountsUrl = `https://accounts.${this.dc}/oauth/v2/token`
    const params = new URLSearchParams({
      refresh_token: this.data.refreshToken,
      client_id: this.data.clientId || process.env.ZOHO_CLIENT_ID,
      client_secret: this.data.clientSecret || process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })

    try {
      console.log(`[Zoho API] Fetching: ${accountsUrl}`)
      const response = await fetch(`${accountsUrl}?${params.toString()}`, {
        method: 'POST'
      })
      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(`Zoho Token Refresh Failed: ${result.error || 'Unknown Error'}`)
      }

      // Update integration data
      this.data.accessToken = result.access_token
      this.data.expiresAt = Date.now() + (result.expires_in * 1000)
      
      // Persist back to DB
      await this.saveIntegration()
      
      return this.data.accessToken
    } catch (err) {
      console.error(`[Zoho API] Refresh Error:`, err.message, err.cause ? err.cause : err)
      throw err
    }
  }

  async saveIntegration() {
    const encryptedData = JSON.stringify(encrypt(JSON.stringify(this.data)))
    await query(
      'UPDATE integrations SET zoho = ?, updatedAt = NOW() WHERE userId = ?',
      [encryptedData, this.userId]
    )
  }

  async request(method, path, body = null) {
    const token = await this.getAccessToken()
    const url = `${this.baseUrl}${path}`
    
    const options = {
      method,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json'
      }
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    try {
      console.log(`[Zoho API] Requesting: ${method} ${url}`)
      const res = await fetch(url, options)
      if (res.status === 204) return null
      
      const result = await res.json()
      if (!res.ok) {
        console.error(`[Zoho API] Error ${res.status}:`, JSON.stringify(result))
        throw new Error(result.message || `Zoho API Error ${res.status}`)
      }
      
      return result
    } catch (err) {
      console.error(`[Zoho API] Request Failed for ${url}:`, err.message, err.cause ? err.cause : '')
      throw err
    }
  }

  /**
   * Update a Lead's status
   */
  async updateLeadStatus(leadId, status) {
    console.log(`[Zoho API] Updating Lead ${leadId} status to: ${status}`)
    return this.request('PUT', '/Leads', {
      data: [{
        id: leadId,
        Lead_Status: status
      }]
    })
  }

  async findLeadByPhone(phone) {
    if (!phone) return null

    const criteria = encodeURIComponent(`(Phone:equals:${phone})`)
    const result = await this.request('GET', `/Leads/search?criteria=${criteria}`)
    return Array.isArray(result?.data) ? result.data[0] : null
  }

  async createLead(payload) {
    console.log(`[Zoho API] Creating Lead for WhatsApp ${payload?.WhatsApp_Number || payload?.Phone || ''}`)
    return this.request('POST', '/Leads', {
      data: [payload]
    })
  }

  async updateLead(leadId, payload) {
    console.log(`[Zoho API] Updating Lead ${leadId}`)
    return this.request('PUT', '/Leads', {
      data: [{
        id: leadId,
        ...payload
      }]
    })
  }

  async upsertLead(payload, searchPhone = payload?.Phone || payload?.WhatsApp_Number) {
    const existingLead = await this.findLeadByPhone(searchPhone)

    if (existingLead?.id) {
      return this.updateLead(existingLead.id, payload.updateFields || payload)
    }

    return this.createLead(payload.createFields || payload)
  }

  /**
   * Add a note to a Lead
   */
  async addNote(module, recordId, content, title = 'WhatsApp Conversation') {
    console.log(`[Zoho API] Adding note to ${module} ${recordId}`)
    return this.request('POST', '/Notes', {
      data: [{
        Parent_Id: recordId,
        se_module: module,
        Note_Title: title,
        Note_Content: content
      }]
    })
  }
}

/**
 * Helper to get a Zoho client for a user
 */
export async function getZohoClient(userId) {
  const row = await queryOne('SELECT zoho FROM integrations WHERE userId = ?', [userId])
  if (!row?.zoho) return null
  
  try {
    const decrypted = JSON.parse(decrypt(row.zoho))
    return new ZohoClient(userId, decrypted)
  } catch (e) {
    return null
  }
}
