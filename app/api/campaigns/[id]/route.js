import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { requireRequestUserId } from '@/lib/request-user'

export async function DELETE(request, { params }) {
  try {
    const userId = requireRequestUserId(request)
    await query('DELETE FROM campaigns WHERE id = ? AND userId = ?', [params.id, userId])
    return NextResponse.json({ success: true, message: 'Campaign deleted successfully' })
  } catch (error) {
    const status = error.status || 500
    console.error('Error deleting campaign:', error)
    return NextResponse.json({ error: status === 401 ? 'Not authenticated' : 'Failed to delete campaign' }, { status })
  }
}
