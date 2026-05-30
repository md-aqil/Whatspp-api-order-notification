
import { NextResponse } from 'next/server';
import { getZohoClient } from '@/lib/zoho-api';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/auth';

export async function GET(request) {
  const session = await getIronSession(request, new Response(), sessionOptions);
  const user = session.user;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const zohoClient = await getZohoClient(user.id);
    if (!zohoClient) {
      return NextResponse.json({ error: 'Zoho integration not found' }, { status: 404 });
    }

    const response = await zohoClient.request('GET', '/users/current');
    const accountInfo = response?.users?.[0];

    if (!accountInfo) {
      return NextResponse.json({ error: 'Failed to fetch Zoho account information' }, { status: 500 });
    }

    return NextResponse.json({ accountInfo });
  } catch (error) {
    console.error('Failed to fetch Zoho account information:', error);
    return NextResponse.json({ error: 'Failed to fetch Zoho account information' }, { status: 500 });
  }
}
