import { query, queryOne } from './mysql'
import { decrypt, encrypt } from './encryption'

/**
 * Google Sheets & Drive API Client using native fetch.
 * Avoids extra bulky npm packages while maintaining maximum performance.
 */
export class GoogleSheetsClient {
  constructor(userId, integrationData) {
    this.userId = userId
    this.data = integrationData || {}
  }

  async getAccessToken() {
    const now = Date.now()
    // If we have an access token and it's not expired yet (with 1 min safety buffer)
    if (this.data.tokens?.accessToken && this.data.tokens?.expiry && now < this.data.tokens.expiry - 60000) {
      return this.data.tokens.accessToken
    }

    if (!this.data.tokens?.refreshToken) {
      throw new Error('Google Sheets Refresh Token missing. Please re-authenticate.')
    }

    return this.refreshTokens()
  }

  async refreshTokens() {
    console.log(`[Google Sheets API] Refreshing tokens for user ${this.userId}`)
    
    const tokenUrl = 'https://oauth2.googleapis.com/token'
    const body = new URLSearchParams({
      refresh_token: this.data.tokens.refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      })
      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(`Google Sheets Token Refresh Failed: ${result.error_description || result.error || 'Unknown Error'}`)
      }

      // Update integration data
      this.data.tokens = {
        ...this.data.tokens,
        accessToken: result.access_token,
        expiry: Date.now() + (result.expires_in * 1000)
      }
      
      // Persist back to DB
      await this.saveIntegration()
      
      return this.data.tokens.accessToken
    } catch (err) {
      console.error(`[Google Sheets API] Refresh Error:`, err.message)
      throw err
    }
  }

  async saveIntegration() {
    const encryptedData = JSON.stringify(encrypt(JSON.stringify(this.data)))
    await query(
      'UPDATE integrations SET googleSheets = ?, updatedAt = NOW() WHERE userId = ?',
      [encryptedData, this.userId]
    )
  }

  async request(method, url, body = null) {
    const token = await this.getAccessToken()
    
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    try {
      console.log(`[Google Sheets API] Requesting: ${method} ${url}`)
      const res = await fetch(url, options)
      if (res.status === 204) return null
      
      const result = await res.json()
      if (!res.ok) {
        console.error(`[Google Sheets API] Error ${res.status}:`, JSON.stringify(result))
        throw new Error(result.error?.message || `Google Sheets API Error ${res.status}`)
      }
      
      return result
    } catch (err) {
      console.error(`[Google Sheets API] Request Failed for ${url}:`, err.message)
      throw err
    }
  }

  /**
   * List Spreadsheets from Google Drive
   */
  async listSpreadsheets() {
    const url = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'+and+trashed=false&fields=files(id,name)&pageSize=100`
    const result = await this.request('GET', url)
    return result?.files || []
  }

  /**
   * List Worksheet Tabs from a Spreadsheet
   */
  async listSheets(spreadsheetId) {
    if (!spreadsheetId) return []
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(title)`
    const result = await this.request('GET', url)
    return (result?.sheets || []).map(s => s.properties?.title).filter(Boolean)
  }

  /**
   * Append a row to a worksheet tab
   */
  async appendRow(spreadsheetId, sheetName, rowValues) {
    if (!spreadsheetId || !rowValues || !Array.isArray(rowValues)) {
      throw new Error('Spreadsheet ID and values are required to append a row.')
    }
    const targetSheet = sheetName || 'Sheet1'
    const range = `${targetSheet}!A:Z`
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
    
    // Escaping special characters at start of values to prevent Google Sheets Formula Injection (Formula hijacking)
    const sanitizedValues = rowValues.map(val => {
      const stringVal = String(val ?? '')
      if (stringVal.startsWith('=') || stringVal.startsWith('+') || stringVal.startsWith('-') || stringVal.startsWith('@')) {
        return `'${stringVal}` // Prepend a single quote to force it to render as text literal
      }
      return val
    })

    const payload = {
      values: [sanitizedValues]
    }

    return this.request('POST', url, payload)
  }
}

/**
 * Helper to get a GoogleSheets client for a user
 */
export async function getGoogleSheetsClient(userId) {
  const row = await queryOne('SELECT googleSheets FROM integrations WHERE userId = ?', [userId])
  if (!row?.googleSheets) return null
  
  try {
    const decrypted = JSON.parse(decrypt(row.googleSheets))
    return new GoogleSheetsClient(userId, decrypted)
  } catch (e) {
    return null
  }
}
