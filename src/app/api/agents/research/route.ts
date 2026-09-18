import { NextRequest, NextResponse } from 'next/server';
import { researchBatch } from '@/lib/aiAgents/server/research';
import { requireManager } from '@/lib/aiAgents/server/runtime';

// "Research next batch" from the portal. Spends Claude credit, so managers only.

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!(await requireManager())) return NextResponse.json({ error: 'Only owners, admins and supervisors can run agents' }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Claude is not connected yet: add ANTHROPIC_API_KEY in Vercel' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(10, Math.max(1, Number(body.limit) || 5));
  try {
    return NextResponse.json(await researchBatch(limit));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
