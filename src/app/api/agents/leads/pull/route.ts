import { NextRequest, NextResponse } from 'next/server';
import { pullLeads } from '@/lib/aiAgents/server/leadgen';
import { admin, logEvent, requireManager } from '@/lib/aiAgents/server/runtime';

// Lead Generation: start a Google Maps pull for one niche in one city. Apify
// calls /api/agents/leads/webhook when the run finishes; that is where the leads
// land. Starting a run spends Apify credit, so only managers may do it.

export async function POST(req: NextRequest) {
  if (!(await requireManager())) return NextResponse.json({ error: 'Only owners, admins and supervisors can run agents' }, { status: 403 });
  if (!process.env.APIFY_TOKEN || !process.env.APIFY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Apify is not connected yet: add APIFY_TOKEN and APIFY_WEBHOOK_SECRET in Vercel' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const nicheKey = String(body.niche ?? '');
  const city = String(body.city ?? '').trim();
  const max = Math.min(100, Math.max(5, Number(body.max) || 20));
  if (!nicheKey || !city) return NextResponse.json({ error: 'Pick a niche and a city' }, { status: 400 });

  const db = admin();
  const { data: niche } = await db.from('ai_niches').select('key, name, active').eq('key', nicheKey).maybeSingle();
  if (!niche) return NextResponse.json({ error: 'Unknown niche' }, { status: 400 });

  const res = await pullLeads(db, niche as { key: string; name: string } as never, city, max, req.nextUrl.origin);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  await logEvent(db, 'leadgen-maps', 'request', `Founder → {agent}: pull up to ${max} ${niche.name} businesses in ${city}`);
  return NextResponse.json({ ok: true, runId: res.runId });
}
