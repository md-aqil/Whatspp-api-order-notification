import { query, queryOne, queryMany } from '../mysql'

const DEFAULT_BRANDING = {
  businessName: 'Our Business',
  logoUrl: null,
  welcomeMessage: 'Hello! How can I help you today?',
  primaryColor: '#005cc0',
  fontFamily: 'Inter',
  position: 'bottom-right',
  botName: 'Support Bot',
  enabled: true
}

/**
 * Get branding configuration for a user
 */
export async function getBranding(userId) {
  try {
    const [rows] = await query(
      'SELECT * FROM branding WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      [userId]
    )

    if (!rows || rows.length === 0) {
      return { ...DEFAULT_BRANDING, userId }
    }

    const row = rows[0]
    return {
      businessName: row.businessName || DEFAULT_BRANDING.businessName,
      logoUrl: row.logoUrl || null,
      welcomeMessage: row.welcomeMessage || DEFAULT_BRANDING.welcomeMessage,
      primaryColor: row.primaryColor || DEFAULT_BRANDING.primaryColor,
      fontFamily: row.fontFamily || DEFAULT_BRANDING.fontFamily,
      position: row.position || DEFAULT_BRANDING.position,
      botName: row.botName || DEFAULT_BRANDING.botName,
      enabled: row.enabled !== null && row.enabled !== undefined ? Boolean(row.enabled) : DEFAULT_BRANDING.enabled,
      userId: row.userId || userId,
      id: row.id || null
    }
  } catch (error) {
    console.error('Get branding error:', error.message)
    return { ...DEFAULT_BRANDING, userId }
  }
}

/**
 * Upsert branding configuration for a user
 */
export async function upsertBranding(userId, data) {
  const existing = await queryOne(
    'SELECT id FROM branding WHERE userId = ? LIMIT 1',
    [userId]
  )

  const brandingData = {
    businessName: data.businessName || DEFAULT_BRANDING.businessName,
    logoUrl: data.logoUrl || null,
    welcomeMessage: data.welcomeMessage || DEFAULT_BRANDING.welcomeMessage,
    primaryColor: data.primaryColor || DEFAULT_BRANDING.primaryColor,
    fontFamily: data.fontFamily || DEFAULT_BRANDING.fontFamily,
    position: data.position || DEFAULT_BRANDING.position,
    botName: data.botName || DEFAULT_BRANDING.botName,
    enabled: data.enabled !== null && data.enabled !== undefined ? Boolean(data.enabled) : DEFAULT_BRANDING.enabled
  }

  if (existing) {
    await query(
      `UPDATE branding SET 
        businessName = ?, logoUrl = ?, welcomeMessage = ?, 
        primaryColor = ?, fontFamily = ?, position = ?, 
        botName = ?, enabled = ?, updatedAt = NOW()
       WHERE id = ?`,
      [
        brandingData.businessName,
        brandingData.logoUrl,
        brandingData.welcomeMessage,
        brandingData.primaryColor,
        brandingData.fontFamily,
        brandingData.position,
        brandingData.botName,
        brandingData.enabled,
        existing.id
      ]
    )
  } else {
    await query(
      `INSERT INTO branding (userId, businessName, logoUrl, welcomeMessage, primaryColor, fontFamily, position, botName, enabled, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        userId,
        brandingData.businessName,
        brandingData.logoUrl,
        brandingData.welcomeMessage,
        brandingData.primaryColor,
        brandingData.fontFamily,
        brandingData.position,
        brandingData.botName,
        brandingData.enabled
      ]
    )
  }

  return getBranding(userId)
}

/**
 * Update only the logo URL for a user
 */
export async function updateLogo(userId, logoUrl) {
  const existing = await queryOne(
    'SELECT id FROM branding WHERE userId = ? LIMIT 1',
    [userId]
  )

  if (existing) {
    await query(
      'UPDATE branding SET logoUrl = ?, updatedAt = NOW() WHERE id = ?',
      [logoUrl, existing.id]
    )
  } else {
    await query(
      'INSERT INTO branding (userId, logoUrl, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())',
      [userId, logoUrl]
    )
  }

  return getBranding(userId)
}

/**
 * Check if branding is enabled for a user
 */
export async function isBrandingEnabled(userId) {
  try {
    const branding = await getBranding(userId)
    return branding.enabled
  } catch (error) {
    console.error('Check branding enabled error:', error.message)
    return false
  }
}