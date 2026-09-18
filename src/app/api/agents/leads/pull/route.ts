import { NextRequest, NextResponse } from 'next/server';
import { startMapsRun } from '@/lib/aiAgents/server/apify';
import { admin, finishWork, logEvent, requireManager, setDesk, startWork } from '@/lib/aiAgents/server/runtime';

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

  const workId = await startWork(db, 'leadgen-maps', `Pull ${niche.name} in ${city}`, `Up to ${max} businesses from Google Maps`);
  const hook = new URL('/api/agents/leads/webhook', req.nextUrl.origin);
  hook.searchParams.set('secret', process.env.APIFY_WEBHOOK_SECRET);
  hook.searchParams.set('niche', niche.key);
  hook.searchParams.set('city', city);
  if (workId) hook.searchParams.set('work', workId);

  try {
    const run = await startMapsRun({ niche: niche.key, city, max, webhookUrl: hook.toString() });
    await setDesk(db, 'leadgen-maps', 'working', `Pull ${niche.name} in ${city}`);
    await logEvent(db, 'leadgen-maps', 'request', `Founder → {agent}: pull up to ${max} ${niche.name} businesses in ${city} (Apify run ${run.runId})`, workId);
    return NextResponse.json({ ok: true, runId: run.runId });
  } catch (e) {
    const msg = (e as Error).message;
    await finishWork(db, workId, `Could not start the Apify run: ${msg}`, false);
    await logEvent(db, 'leadgen-maps', 'alert', `{agent} could not start the ${niche.name} pull in ${city}: ${msg}`, workId);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
