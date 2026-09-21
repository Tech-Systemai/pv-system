import { NextRequest, NextResponse } from 'next/server';
import { admin, requireManager } from '@/lib/aiAgents/server/runtime';
import { readyCount, topUpLeads } from '@/lib/aiAgents/server/leadgen';
import { researchBatch } from '@/lib/aiAgents/server/research';
import { checkReplies, sendBatch } from '@/lib/aiAgents/server/sender';
import { writeBatch } from '@/lib/aiAgents/server/writer';

// "Work now": the founder putting the agents to work outside the usual round.
// Research and writing run whenever asked; sending still waits for office hours
// so prospects never get an email at 11pm.

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!(await requireManager())) return NextResponse.json({ error: 'Only owners, admins and supervisors can run the agents' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const what = String(body.what ?? 'all');
  const db = admin();
  const out: Record<string, unknown> = {};

  try {
    if (what === 'topup' || what === 'all') {
      out.leads = await topUpLeads(db, { force: what === 'topup', max: Math.min(80, Math.max(10, Number(body.max) || 40)) });
    }
    if (what === 'research' || what === 'all') out.research = await researchBatch(Math.min(12, Math.max(1, Number(body.limit) || 8)));
    if (what === 'write' || what === 'all') out.write = await writeBatch(Math.min(10, Math.max(1, Number(body.limit) || 5)));
    if (what === 'send' || what === 'all') {
      out.send = await sendBatch({ force: true });
      out.replies = await checkReplies();
    }
    out.ready = await readyCount(db);
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
