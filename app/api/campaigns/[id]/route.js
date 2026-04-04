import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function DELETE(request, { params }) {
  try {
    await query('DELETE FROM campaigns WHERE id = ? AND userId = ?', [params.id, 'default'])
    return NextResponse.json({ success: true, message: 'Campaign deleted successfully' })
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  }
}
