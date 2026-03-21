import { NextResponse } from 'next/server'
import { query, queryMany } from '@/lib/postgres'

async function ensureCampaignSchema() {
  await query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "templateLanguage" TEXT')
  await query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "templateCategory" TEXT')
  await query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "templateHeaderImageUrl" TEXT')
  await query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "campaignType" TEXT DEFAULT \'template\'')
  await query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "productIds" JSONB DEFAULT \'[]\'::jsonb')
  await query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT \'[]\'::jsonb')
}

export async function GET() {
  try {
    await ensureCampaignSchema()
    const campaigns = await queryMany(
      `SELECT id, name, template, "templateLanguage", "templateCategory", "templateHeaderImageUrl", "campaignType", "productIds", message, variables, audience, recipients, status, results, "sentAt", "failedAt", "createdAt"
       FROM campaigns
       WHERE "userId" = $1
       ORDER BY "createdAt" DESC NULLS LAST`,
      ['default']
    )

    return NextResponse.json(campaigns)
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureCampaignSchema()
    const campaignData = await request.json()

    if (!campaignData.name || !campaignData.template) {
      return NextResponse.json({ error: 'Campaign name and template are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const status = campaignData.scheduledAt ? 'scheduled' : (campaignData.status || 'draft')

    await query(
      `INSERT INTO campaigns (id, "userId", name, template, "templateLanguage", "templateCategory", "templateHeaderImageUrl", "campaignType", "productIds", message, variables, audience, recipients, status, results, "sentAt", "failedAt", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::jsonb, $12, $13::jsonb, $14, $15::jsonb, $16, $17, NOW())`,
      [
        id,
        'default',
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

    const [created] = await queryMany(
      `SELECT id, name, template, "templateLanguage", "templateCategory", "templateHeaderImageUrl", "campaignType", "productIds", message, variables, audience, recipients, status, results, "sentAt", "failedAt", "createdAt"
       FROM campaigns WHERE id = $1`,
      [id]
    )

    return NextResponse.json(created)
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}
