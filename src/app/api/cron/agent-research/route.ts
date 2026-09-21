import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/aiAgents/server/runtime';
import { topUpLeads } from '@/lib/aiAgents/server/leadgen';
import { researchBatch } from '@/lib/aiAgents/server/research';
import { checkReplies, sendBatch } from '@/lib/aiAgents/server/sender';
import { writeBatch } from '@/lib/aiAgents/server/writer';

// The live agents' heartbeat, around the clock, every 15 minutes from
// .github/workflows/agent-research.yml: Research scores new leads, Quill writes
// emails for qualified email-first leads, Post sends the approved queue (within
// hours and warm-up limits) and checks threads for replies. Spends API credit,
// so it requires the AGENT_CRON_SECRET bearer token (separate from the
// CRON_SECRET the older portal jobs use).

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const secret = process.env.AGENT_CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const out: Record<string, unknown> = {};
  const step = async (name: string, run: () => Promise<unknown>) => {
    try { out[name] = await run(); } catch (e) { out[name] = { error: (e as Error).message }; }
  };
  if (process.env.APIFY_TOKEN) await step('leads', () => topUpLeads(admin()));
  if (process.env.ANTHROPIC_API_KEY) {
    await step('research', () => researchBatch(6));
    await step('write', () => writeBatch(4));
  }
  await step('send', sendBatch);
  await step('replies', checkReplies);
  return NextResponse.json(out);
}
