import { NextRequest, NextResponse } from 'next/server';
import { researchBatch } from '@/lib/aiAgents/server/research';

// Keeps Research working through the backlog without anyone pressing a button.
// Called every 15 minutes by .github/workflows/agent-research.yml. It spends
// Claude credit, so it requires the CRON_SECRET bearer token.

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ skipped: 'ANTHROPIC_API_KEY not set' });
  return NextResponse.json(await researchBatch(6));
}
