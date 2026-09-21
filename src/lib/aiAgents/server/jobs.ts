import { topUpLeads } from './leadgen';
import { researchBatch } from './research';
import { admin, logEvent } from './runtime';
import { checkReplies, sendBatch } from './sender';
import { writeBatch } from './writer';

// The jobs an agent can actually run, in one place: the task bar, the office
// conversations, the routines and the heartbeat all go through here.

export const JOBS = ['find_leads', 'research', 'write_emails', 'send_emails'] as const;
export type Job = (typeof JOBS)[number];

/** Which agent owns each job, by slug. */
export const JOB_OWNER: Record<Job, string> = {
  find_leads: 'leadgen-maps',
  research: 'research-qualifier',
  write_emails: 'outreach-writer',
  send_emails: 'outreach-sender',
};

export const JOB_LABEL: Record<Job, string> = {
  find_leads: 'pull a fresh batch of businesses from Google Maps',
  research: 'score and qualify the leads waiting',
  write_emails: 'write emails for qualified leads',
  send_emails: 'send the emails you approved',
};

type Params = { max?: number; limit?: number; niche?: string; city?: string };

/** Run one job now and say plainly what happened. */
export async function runJob(job: Job, params: Params = {}): Promise<string> {
  const db = admin();
  if (job === 'find_leads') {
    const r = await topUpLeads(db, { force: true, max: Math.min(80, Math.max(10, params.max ?? 40)) }) as Record<string, unknown>;
    return r.ok
      ? `Started a Google Maps pull: ${r.niche} in ${r.city}. They land in a couple of minutes and get researched straight away.`
      : `No pull started: ${r.error ?? r.skipped}`;
  }
  if (job === 'research') {
    const r = await researchBatch(Math.min(12, Math.max(1, params.limit ?? 10)), 4);
    return r.researched
      ? `Researched ${r.researched} leads — ${r.qualified} qualified${r.failed ? `, ${r.failed} failed` : ''}.`
      : 'Nothing was waiting to be researched.';
  }
  if (job === 'write_emails') {
    const r = await writeBatch(Math.min(10, Math.max(1, params.limit ?? 5))) as { written: number; skipped?: number; waiting?: string };
    if (r.waiting === 'settings') return 'Cannot write yet: the postal address is missing in the Outreach settings.';
    return r.written
      ? `Wrote ${r.written} emails${r.skipped ? `, skipped ${r.skipped}` : ''} — they are waiting for your approval.`
      : 'No qualified email-first leads were waiting.';
  }
  const sent = await sendBatch({ force: true });
  const replies = await checkReplies();
  return sent.sent
    ? `Sent ${sent.sent}${replies.replies ? `, and ${replies.replies} replies came in` : ''}.`
    : `Nothing sent: ${sent.reason ?? 'nothing approved yet'}.`;
}

/** Your own process notes, added to an agent's brief before it works. */
export async function skillsFor(slug: string, department: string): Promise<string> {
  const { data } = await admin().from('ai_skills').select('name, body, scope, target').eq('active', true);
  const mine = (data ?? []).filter(s =>
    s.scope === 'all' || (s.scope === 'agent' && s.target === slug) || (s.scope === 'department' && s.target === department));
  if (!mine.length) return '';
  return `\n\nHow the founder wants this done (follow these over your own habits):\n${mine.map(s => `— ${s.name}: ${s.body}`).join('\n')}`;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function dueNow(r: { days: string; at_hour: number; at_minute: number; last_run_at: string | null }, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now).map(p => [p.type, p.value]),
  );
  const day = String(parts.weekday).toLowerCase();
  const dayOk = r.days === 'daily'
    || (r.days === 'weekdays' && !['sat', 'sun'].includes(day))
    || r.days.split(/[,\s]+/).map(d => d.slice(0, 3).toLowerCase()).includes(day);
  if (!dayOk || !DAY_KEYS.includes(day)) return false;
  const mins = Number(parts.hour) % 24 * 60 + Number(parts.minute);
  const due = r.at_hour * 60 + r.at_minute;
  // The heartbeat runs every 15 minutes, so fire anything due in the last 20.
  if (mins < due || mins > due + 20) return false;
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  if (!r.last_run_at) return true;
  const ranOn = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(r.last_run_at));
  return ranOn !== today;
}

/** Fire whichever routines are due. Each runs at most once a day. */
export async function runDueRoutines() {
  const db = admin();
  const { data } = await db.from('ai_routines').select('*').eq('active', true);
  const ran: { name: string; result: string }[] = [];
  for (const r of data ?? []) {
    if (!dueNow(r)) continue;
    const result = await runJob(r.action as Job, (r.params ?? {}) as Params);
    await db.from('ai_routines').update({ last_run_at: new Date().toISOString(), last_result: result, updated_at: new Date().toISOString() }).eq('id', r.id);
    await logEvent(db, JOB_OWNER[r.action as Job], 'progress', `Routine "${r.name}": ${result}`);
    ran.push({ name: r.name, result });
  }
  return ran;
}
