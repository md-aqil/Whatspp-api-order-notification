import { NextResponse } from 'next/server'
import { getPool } from '@/lib/postgres'
import { ensureSettingsTables } from '@/lib/settings-db'
import { resolveRequestUserId } from '@/lib/request-user'
import { validateWhatsAppPhoneNumberAccess } from '@/lib/whatsapp-meta'

let pool

function getMysqlPool() {
  if (!pool) {
    pool = getPool()
  }
  return pool
}

async function getStoredWhatsAppAccounts(userId = 'default') {
  try {
    await ensureSettingsTables()
    const pool = getMysqlPool()
    const [rows] = await pool.execute(
      'SELECT id, userId, accountName, phoneNumberId, businessAccountId, phoneNumber, status, createdAt, updatedAt FROM whatsapp_accounts WHERE userId = ? ORDER BY createdAt DESC',
      [userId]
    )
    return rows || []
  } catch (error) {
    console.error('[getStoredWhatsAppAccounts] Error:', error.message)
    return []
  }
}

async function getWhatsAppAccountById(accountId, userId = 'default') {
  try {
    await ensureSettingsTables()
    const pool = getMysqlPool()
    const [rows] = await pool.execute(
      'SELECT id, userId, accountName, phoneNumberId, accessToken, businessAccountId, phoneNumber, status, createdAt, updatedAt FROM whatsapp_accounts WHERE id = ? AND userId = ?',
      [accountId, userId]
    )
    return rows[0] || null
  } catch (error) {
    console.error('[getWhatsAppAccountById] Error:', error.message)
    return null
  }
}

async function saveWhatsAppAccount(accountData, userId = 'default') {
  try {
    await ensureSettingsTables()
    const pool = getMysqlPool()
    const { id, accountName, phoneNumberId, accessToken, businessAccountId, phoneNumber } = accountData
    const accountId = id || `wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const [existing] = await pool.execute(
      'SELECT id FROM whatsapp_accounts WHERE id = ? AND userId = ?',
      [accountId, userId]
    )
    
    if (existing[0]) {
      await pool.execute(
        `UPDATE whatsapp_accounts SET accountName = ?, phoneNumberId = ?, accessToken = ?, businessAccountId = ?, phoneNumber = ?, updatedAt = NOW() WHERE id = ? AND userId = ?`,
        [accountName, phoneNumberId, accessToken, businessAccountId, phoneNumber, accountId, userId]
      )
    } else {
      await pool.execute(
        `INSERT INTO whatsapp_accounts (id, userId, accountName, phoneNumberId, accessToken, businessAccountId, phoneNumber, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [accountId, userId, accountName, phoneNumberId, accessToken, businessAccountId, phoneNumber]
      )
    }
    
    return accountId
  } catch (error) {
    console.error('[saveWhatsAppAccount] Error:', error.message)
    throw error
  }
}

async function deleteWhatsAppAccount(accountId, userId = 'default') {
  try {
    await ensureSettingsTables()
    const pool = getMysqlPool()
    const [result] = await pool.execute(
      'DELETE FROM whatsapp_accounts WHERE id = ? AND userId = ?',
      [accountId, userId]
    )
    return result.affectedRows > 0
  } catch (error) {
    console.error('[deleteWhatsAppAccount] Error:', error.message)
    return false
  }
}

export async function GET(request) {
  try {
    await ensureSettingsTables()
    const url = new URL(request.url)
    const userId = resolveRequestUserId(request, url.searchParams.get('userId'))
    
    const accounts = await getStoredWhatsAppAccounts(userId)
    
    const safeAccounts = accounts.map(acc => ({
      id: acc.id,
      userId: acc.userId,
      accountName: acc.accountName,
      phoneNumberId: acc.phoneNumberId,
      businessAccountId: acc.businessAccountId,
      phoneNumber: acc.phoneNumber,
      status: acc.status,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt
    }))
    
    return NextResponse.json({ accounts: safeAccounts })
  } catch (error) {
    console.error('Error fetching WhatsApp accounts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch WhatsApp accounts' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    await ensureSettingsTables()
    const body = await request.json()
    
    const {
      userId: requestedUserId,
      accountName,
      phoneNumberId,
      accessToken,
      businessAccountId,
      phoneNumber
    } = body
    const userId = resolveRequestUserId(request, requestedUserId)
    
    if (!accountName || !phoneNumberId || !accessToken) {
      return NextResponse.json(
        { error: 'accountName, phoneNumberId, and accessToken are required' },
        { status: 400 }
      )
    }

    await validateWhatsAppPhoneNumberAccess(phoneNumberId, accessToken, businessAccountId)
    
    const accountId = await saveWhatsAppAccount({
      accountName,
      phoneNumberId,
      accessToken,
      businessAccountId,
      phoneNumber
    }, userId)
    
    return NextResponse.json({
      success: true,
      accountId,
      message: 'WhatsApp account saved successfully'
    })
  } catch (error) {
    console.error('Error saving WhatsApp account:', error)
    return NextResponse.json(
      { error: 'Failed to save WhatsApp account: ' + error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request) {
  try {
    await ensureSettingsTables()
    const body = await request.json()
    
    const {
      userId: requestedUserId,
      id,
      accountName,
      phoneNumberId,
      accessToken,
      businessAccountId,
      phoneNumber
    } = body
    const userId = resolveRequestUserId(request, requestedUserId)
    
    if (!id || !accountName || !phoneNumberId || !accessToken) {
      return NextResponse.json(
        { error: 'id, accountName, phoneNumberId, and accessToken are required' },
        { status: 400 }
      )
    }

    await validateWhatsAppPhoneNumberAccess(phoneNumberId, accessToken, businessAccountId)
    
    const accountId = await saveWhatsAppAccount({
      id,
      accountName,
      phoneNumberId,
      accessToken,
      businessAccountId,
      phoneNumber
    }, userId)
    
    return NextResponse.json({
      success: true,
      accountId,
      message: 'WhatsApp account updated successfully'
    })
  } catch (error) {
    console.error('Error updating WhatsApp account:', error)
    return NextResponse.json(
      { error: 'Failed to update WhatsApp account: ' + error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request) {
  try {
    await ensureSettingsTables()
    const url = new URL(request.url)
    const userId = resolveRequestUserId(request, url.searchParams.get('userId'))
    const accountId = url.searchParams.get('id')
    
    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }
    
    const deleted = await deleteWhatsAppAccount(accountId, userId)
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'WhatsApp account not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'WhatsApp account deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting WhatsApp account:', error)
    return NextResponse.json(
      { error: 'Failed to delete WhatsApp account: ' + error.message },
      { status: 500 }
    )
  }
}
