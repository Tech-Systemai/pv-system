import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, profileEmail } from '@/lib/aiAgents/server/gmail';
import { admin, logEvent, requireManager } from '@/lib/aiAgents/server/runtime';

// Step 2: Google sends the founder back here. Store the inbox's refresh token
// (server-only table) and return to the Outreach tab.

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const back = (msg: string) => NextResponse.redirect(new URL(`/dashboard/owner/ai-agents?inbox=${encodeURIComponent(msg)}`, req.nextUrl.origin));

  const manager = await requireManager();
  if (!manager) return back('Only owners and admins can connect the inbox');
  if (q.get('error')) return back(`Google said: ${q.get('error')}`);
  const state = req.cookies.get('ag_gmail_state')?.value;
  if (!state || state !== q.get('state')) return back('The sign-in expired, please try again');

  try {
    const tok = await exchangeCode(q.get('code') ?? '', req.nextUrl.origin);
    if (!tok.refresh_token) return back('Google did not grant offline access, please try again');
    const email = await profileEmail(tok.access_token);
    const db = admin();
    await db.from('ai_mailboxes').upsert({ email, refresh_token: tok.refresh_token, connected_by: manager.userId, connected_at: new Date().toISOString() });
    await logEvent(db, 'outreach-sender', 'done', `{agent} is connected to ${email} and starts on the warm-up ramp`);
    const res = back(`connected:${email}`);
    res.cookies.delete({ name: 'ag_gmail_state', path: '/api/agents/gmail' });
    return res;
  } catch (e) {
    return back((e as Error).message);
  }
}
