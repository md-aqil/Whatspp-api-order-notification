import { NextResponse } from 'next/server'
import { query, queryMany } from '@/lib/postgres'
import { requireRequestUserId } from '@/lib/request-user'

async function ensureCampaignSchema() {
  try {
    await query('ALTER TABLE campaigns ADD COLUMN templateLanguage TEXT')
    await query('ALTER TABLE campaigns ADD COLUMN templateCategory TEXT')
    await query('ALTER TABLE campaigns ADD COLUMN templateHeaderImageUrl TEXT')
    await query('ALTER TABLE campaigns ADD COLUMN campaignType TEXT DEFAULT "template"')
    await query('ALTER TABLE campaigns ADD COLUMN productIds JSON DEFAULT "[]"')
    await query('ALTER TABLE campaigns ADD COLUMN variables JSON DEFAULT "[]"')
  } catch (e) {
    // Column might already exist
  }
}

export async function GET(request) {
  try {
    const userId = requireRequestUserId(request)
    await ensureCampaignSchema()
    const [rows] = await query(
      `SELECT id, name, template, templateLanguage, templateCategory, templateHeaderImageUrl, campaignType, productIds, message, variables, audience, recipients, status, results, sentAt, failedAt, createdAt
       FROM campaigns
       WHERE userId = ?
       ORDER BY createdAt DESC`,
      [userId]
    )

    return NextResponse.json(rows || [])
  } catch (error) {
    const status = error.status || 500
    console.error('Error fetching campaigns:', error)
    return NextResponse.json({ error: status === 401 ? 'Not authenticated' : 'Failed to fetch campaigns' }, { status })
  }
}

export async function POST(request) {
  try {
    const userId = requireRequestUserId(request)
    await ensureCampaignSchema()
    const campaignData = await request.json()

    if (!campaignData.name || !campaignData.template) {
      return NextResponse.json({ error: 'Campaign name and template are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const status = campaignData.scheduledAt ? 'scheduled' : (campaignData.status || 'draft')

    await query(
      `INSERT INTO campaigns (id, userId, name, template, templateLanguage, templateCategory, templateHeaderImageUrl, campaignType, productIds, message, variables, audience, recipients, status, results, sentAt, failedAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        userId,
        campaignData.name,
        campaignData.template,
        campaignData.templateLanguage || '',
        campaignData.templateCategory || '',
        campaignData.templateHeaderImageUrl || '',
        campaignData.campaignType || 'template',
        JSON.stringify(Array.isArray(campaignData.productIds) ? campaignData.productIds : []),
        campaignData.message || '',
        JSON.stringify(Array.isArray(campaignData.variables) ? campaignData.variables : []),
        campaignData.audience || 'all_customers',
        JSON.stringify(campaignData.recipients || []),
        status,
        JSON.stringify([]),
        campaignData.scheduledAt ? new Date(campaignData.scheduledAt) : null,
        null
      ]
    )

    const [rows] = await query(
      `SELECT id, name, template, templateLanguage, templateCategory, templateHeaderImageUrl, campaignType, productIds, message, variables, audience, recipients, status, results, sentAt, failedAt, createdAt
       FROM campaigns WHERE id = ? AND userId = ?`,
      [id, userId]
    )

    return NextResponse.json(rows[0])
  } catch (error) {
    const status = error.status || 500
    console.error('Error creating campaign:', error)
    return NextResponse.json({ error: status === 401 ? 'Not authenticated' : 'Failed to create campaign' }, { status })
  }
}
