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

// DELETE /api/campaigns/[id] - Delete a campaign
export async function DELETE(request, { params }) {
  try {
    const { id } = params
    const db = await connectToMongo()
    
    const result = await db.collection('campaigns').deleteOne({ 
      id: id, 
      userId: 'default' 
    })
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Campaign deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    )
  }
}