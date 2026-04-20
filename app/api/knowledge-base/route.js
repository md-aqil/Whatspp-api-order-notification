import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

async function getUserIdFromRequest() {
  const cookieStore = cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;
  try {
    const decoded = verifyToken(token);
    return decoded.id;
  } catch (e) {
    return null;
  }
}

export async function GET() {
  const userId = await getUserIdFromRequest();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [rows] = await query('SELECT * FROM knowledge_base WHERE userId = ? ORDER BY createdAt DESC', [userId]);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch knowledge base:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge base' }, { status: 500 });
  }
}

export async function POST(request) {
  const userId = await getUserIdFromRequest();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { title, content } = await request.json();
    if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 });

    const id = uuidv4();
    await query(
      'INSERT INTO knowledge_base (id, userId, title, content) VALUES (?, ?, ?, ?)',
      [id, userId, title || 'Default Knowledge', content]
    );

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Failed to save knowledge base:', error);
    return NextResponse.json({ error: 'Failed to save knowledge base' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const userId = await getUserIdFromRequest();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await request.json();
    await query('DELETE FROM knowledge_base WHERE id = ? AND userId = ?', [id, userId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete knowledge base:', error);
    return NextResponse.json({ error: 'Failed to delete knowledge base' }, { status: 500 });
  }
}
