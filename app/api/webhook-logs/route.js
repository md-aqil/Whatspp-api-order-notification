import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { ensureSettingsTables } from '@/lib/settings-db'

function withCors(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return withCors(new NextResponse('', { status: 200 }))
}

export async function GET(request) {
  try {
    await ensureSettingsTables()

    const { searchParams } = new URL(request.url)
    const rawLimit = parseInt(searchParams.get('limit') || '10', 10)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 10

    const [rows] = await query(
      `SELECT id, type, topic, payload, receivedAt, createdAt
       FROM webhook_logs
       ORDER BY receivedAt DESC
       LIMIT ?`,
      [limit]
    )

    return withCors(NextResponse.json({ logs: rows || [] }))
  } catch (error) {
    console.error('Failed to get webhook logs:', error)
    return withCors(NextResponse.json({ logs: [] }))
  }
}
