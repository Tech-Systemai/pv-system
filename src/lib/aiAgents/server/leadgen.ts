import type { Niche, OutreachSettings } from '../types';
import { startMapsRun } from './apify';
import { admin, finishWork, logEvent, setDesk, startWork } from './runtime';

// Lead Generation keeps itself busy: when the number of qualified leads you
// have not worked yet falls under the target, Scout pulls the next niche and
// city. The same function backs the Pull button and the "top up now" control.

const SITE = process.env.PUBLIC_SITE_URL || 'https://portal.octopusengines.com';

type Db = ReturnType<typeof admin>;

export function webhookUrl(niche: string, city: string, workId: string | null, origin = SITE) {
  const u = new URL('/api/agents/leads/webhook', origin);
  u.searchParams.set('secret', process.env.APIFY_WEBHOOK_SECRET ?? '');
  u.searchParams.set('niche', niche);
  u.searchParams.set('city', city);
  if (workId) u.searchParams.set('work', workId);
  return u.toString();
}

/** Start one Google Maps pull and tell the floor about it. */
export async function pullLeads(db: Db, niche: Niche, city: string, max: number, origin = SITE) {
  const workId = await startWork(db, 'leadgen-maps', `Pull ${niche.name} in ${city}`, `Up to ${max} businesses from Google Maps`);
  try {
    const run = await startMapsRun({ niche: niche.key, city, max, webhookUrl: webhookUrl(niche.key, city, workId, origin) });
    await setDesk(db, 'leadgen-maps', 'working', `Pull ${niche.name} in ${city}`);
    await logEvent(db, 'leadgen-maps', 'progress', `{agent} started a pull: up to ${max} ${niche.name} businesses in ${city}`, workId);
    return { ok: true as const, runId: run.runId, niche: niche.name, city };
  } catch (e) {
    const msg = (e as Error).message;
    await finishWork(db, workId, `Could not start the Apify run: ${msg}`, false);
    await logEvent(db, 'leadgen-maps', 'alert', `{agent} could not start the ${niche.name} pull in ${city}: ${msg}`, workId);
    return { ok: false as const, error: msg };
  }
}

/** Qualified leads nobody has contacted yet: the stock you can work tomorrow. */
export async function readyCount(db: Db) {
  const { data: ready } = await db.from('ai_leads').select('id').eq('status', 'qualified').limit(1000);
  const ids = (ready ?? []).map(l => l.id);
  if (!ids.length) return 0;
  const { data: touched } = await db.from('ai_outreach').select('lead_id').in('lead_id', ids);
  const done = new Set((touched ?? []).map(t => t.lead_id));
  return ids.filter(id => !done.has(id)).length;
}

/** Pick the niche/city pair we have pulled least, so coverage spreads out. */
async function nextTarget(db: Db, settings: OutreachSettings & { pull_cities: string }) {
  const { data: nicheRows } = await db.from('ai_niches').select('*').eq('active', true).order('sort_order');
  const niches = (nicheRows ?? []) as Niche[];
  if (!niches.length) return null;
  const { data: leads } = await db.from('ai_leads').select('niche, city').limit(5000);
  const seen = new Map<string, number>();
  for (const l of leads ?? []) seen.set(`${l.niche}|${(l.city ?? '').toLowerCase()}`, (seen.get(`${l.niche}|${(l.city ?? '').toLowerCase()}`) ?? 0) + 1);

  const fallback = settings.pull_cities.split(/[;,]\s*(?![A-Z]{2}\b)/).map(c => c.trim()).filter(Boolean);
  let best: { niche: Niche; city: string; count: number } | null = null;
  for (const n of niches) {
    const cities = (n.cities || '').split(/[;,]\s*(?![A-Z]{2}\b)/).map(c => c.trim()).filter(Boolean);
    for (const city of (cities.length ? cities : fallback)) {
      const count = seen.get(`${n.key}|${city.split(',')[0].trim().toLowerCase()}`) ?? 0;
      if (!best || count < best.count) best = { niche: n, city, count };
    }
  }
  return best;
}

/** Top the pipeline up if it is running low. Returns what it did. */
export async function topUpLeads(db: Db, opts: { force?: boolean; max?: number } = {}) {
  const { data: s } = await db.from('ai_outreach_settings').select('*').eq('id', 'default').maybeSingle();
  const settings = s as (OutreachSettings & { lead_target: number; pull_cities: string }) | null;
  if (!settings) return { skipped: 'no settings row' };
  const ready = await readyCount(db);
  if (!opts.force && ready >= settings.lead_target) return { skipped: `${ready} leads ready, target ${settings.lead_target}` };

  // One pull at a time: don't stack Apify runs.
  const { data: running } = await db.from('ai_agent_work').select('id, created_at')
    .eq('status', 'in_progress').ilike('title', 'Pull %').order('created_at', { ascending: false }).limit(1);
  const last = running?.[0];
  if (last && Date.now() - new Date(last.created_at).getTime() < 20 * 60_000) {
    return { skipped: 'a pull is already running' };
  }

  const target = await nextTarget(db, settings);
  if (!target) return { skipped: 'no active niches' };
  const res = await pullLeads(db, target.niche, target.city, opts.max ?? 40);
  return { ready, target: settings.lead_target, ...res };
}
