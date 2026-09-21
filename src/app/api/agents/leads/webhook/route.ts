import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse, after } from 'next/server';
import { fetchDataset, toLeadRow } from '@/lib/aiAgents/server/apify';
import { researchBatch } from '@/lib/aiAgents/server/research';
import { admin, finishWork, logEvent, setDesk } from '@/lib/aiAgents/server/runtime';

// Apify calls this when a Google Maps run ends. New businesses become leads in
// their niche (duplicates skipped), then Research starts on the fresh batch.

export const maxDuration = 300;

function secretOk(given: string | null) {
  const want = process.env.APIFY_WEBHOOK_SECRET ?? '';
  if (!want || !given || given.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(want));
}

const key = (name: string, phone: string) => `${name.trim().toLowerCase()}|${phone.replace(/\D/g, '')}`;

export async function POST(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (!secretOk(q.get('secret'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const nicheKey = q.get('niche') ?? '';
  const workId = q.get('work');
  const payload = await req.json().catch(() => ({}));
  const run = payload?.resource ?? {};
  const db = admin();

  if (run.status !== 'SUCCEEDED' || !run.defaultDatasetId) {
    const msg = `Apify run ${run.id ?? ''} ended as ${run.status ?? payload?.eventType ?? 'unknown'}`;
    await finishWork(db, workId, msg, false);
    await setDesk(db, 'leadgen-maps', 'blocked', msg);
    await logEvent(db, 'leadgen-maps', 'alert', `{agent}: ${msg}`, workId);
    return NextResponse.json({ ok: true });
  }

  const items = await fetchDataset(run.defaultDatasetId);
  const rows = items
    .filter(i => i.title && !i.permanentlyClosed && !i.temporarilyClosed)
    .map(i => toLeadRow(i, nicheKey, q.get('city') ?? ''));

  // Skip businesses we already have in this niche (same name + phone).
  const { data: existing } = await db.from('ai_leads').select('business_name, phone').eq('niche', nicheKey).limit(10000);
  const seen = new Set((existing ?? []).map(l => key(l.business_name, l.phone)));
  const fresh = rows.filter(r => {
    const k = key(r.business_name, r.phone);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (fresh.length) {
    const { error } = await db.from('ai_leads').insert(fresh);
    if (error) {
      await finishWork(db, workId, `Could not save leads: ${error.message}`, false);
      await logEvent(db, 'leadgen-maps', 'alert', `{agent} could not save the pull: ${error.message}`, workId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const withEmail = fresh.filter(r => r.email).length;
  const summary = `${items.length} found · ${fresh.length} new · ${rows.length - fresh.length} already known · ${withEmail} with an email`;
  await finishWork(db, workId, summary);
  await setDesk(db, 'leadgen-maps', 'idle');
  await logEvent(db, 'leadgen-maps', 'done', `{agent} finished a Google Maps pull: ${summary}`, workId);

  // Research the fresh batch after replying, so Apify is not kept waiting.
  if (fresh.length && process.env.ANTHROPIC_API_KEY) {
    after(async () => {
      // Sage works straight through the new batch rather than waiting for a sweep.
      const until = Date.now() + 250_000;
      let left = fresh.length;
      while (left > 0 && Date.now() < until) {
        const r = await researchBatch(Math.min(12, left), 4);
        if (!r.researched) break;
        left -= r.researched;
      }
    });
  }
  return NextResponse.json({ ok: true, added: fresh.length });
}
