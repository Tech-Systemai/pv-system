import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { consentUrl, googleReady } from '@/lib/aiAgents/server/gmail';
import { requireManager } from '@/lib/aiAgents/server/runtime';

// Step 1 of connecting the outreach inbox: send the founder to Google's consent
// screen. A one-time state cookie ties the callback to this browser.

export async function GET(req: NextRequest) {
  if (!(await requireManager())) return NextResponse.json({ error: 'Only owners and admins can connect the inbox' }, { status: 403 });
  if (!googleReady()) return NextResponse.json({ error: 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel first' }, { status: 400 });
  const state = randomUUID();
  const res = NextResponse.redirect(consentUrl(req.nextUrl.origin, state, req.nextUrl.searchParams.get('hint') ?? ''));
  res.cookies.set('ag_gmail_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/api/agents/gmail' });
  return res;
}
