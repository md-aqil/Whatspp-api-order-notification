import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'

// Database connection
let client
let db

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
}

// GET /api/campaigns - Get all campaigns
export async function GET() {
  try {
    const db = await connectToMongo()
    const campaigns = await db.collection('campaigns').find({ userId: 'default' }).sort({ createdAt: -1 }).toArray()
    
    // Remove MongoDB _id field
    const cleanedCampaigns = campaigns.map(({ _id, ...rest }) => rest)
    
    return NextResponse.json(cleanedCampaigns)
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }
}

// POST /api/campaigns - Create a new campaign
export async function POST(request) {
  try {
    const campaignData = await request.json()
    const db = await connectToMongo()
    
    const newCampaign = {
      ...campaignData,
      id: Date.now().toString(),
      userId: 'default',
      createdAt: new Date(),
      status: campaignData.scheduledAt ? 'scheduled' : 'draft',
      sentAt: null
    }
    
    await db.collection('campaigns').insertOne(newCampaign)
    
    // Remove MongoDB _id field
    const { _id, ...cleanedCampaign } = newCampaign
    
    return NextResponse.json(cleanedCampaign)
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    )
  }
}