import { TASKS_BY_SLUG, fillTemplate } from './org';
import type { Activity, Agent, AgentEvent, Work } from './types';

// In-browser simulation of the team at work. It never writes to the database;
// every work item and event it produces is flagged `sim` and labelled "sample"
// in the UI. It exists so the HQ reads as a living building before real agents
// report in, and so the founder can see what the feed will look like.

type Stage = 'idle' | 'working' | 'in_review' | 'revising' | 'blocked';

export type SimState = {
  stage: Record<string, Stage>;
  task: Record<string, string>;
  workId: Record<string, string>;
  work: Work[];
  seq: number;
};

export type SimOverlay = Record<string, { activity: Activity; task: string }>;

const OUTPUTS: Record<string, string[]> = {
  exec:       ['Weekly priorities set: roofing volume up, plumbing call list cleared first.', 'Scorecard reviewed: cost per booked demo down 12%.'],
  ops:        ['Stand-up done: research backlog 14 leads, outreach on schedule.', 'Spot-checked 10 scores: 9 agree, 1 re-scored.', 'Capacity plan: add a second inbox for roofing next week.'],
  marketing:  ['5 ad variants drafted, lead line: "Every missed call is a job your competitor books."', '3 reel scripts, 20–30s each, owner-on-a-roof framing.', 'Case study drafted with before/after call numbers.'],
  funnels:    ['GHL page v1: hero, 3 proof blocks, missed-call calculator, booking widget.', 'Headline test: variant B +18% form starts.', 'FAQ section written in trade language.'],
  leadgen:    ['142 businesses pulled · 96 with direct lines · 31 running ads.', 'Owner emails found for 38 of 90 listings.', 'Removed 22 duplicates and 4 closed businesses.'],
  research:   ['12 leads scored: 7 qualified, 5 passed.', 'Channel split this batch: 8 call, 4 email.', '6 call sheets written with openers from reviews.'],
  compliance: ['24 emails checked: 23 clear, 1 blocked for a "Re:" subject.', 'Call list checked against do-not-call: 2 removed.', 'Suppression list updated with 3 opt-outs.'],
  outreach:   ['18 emails personalised from the approved template.', 'Sent 40 within daily limit; bounce rate 1.2%.', 'Day-3 follow-ups queued for 22 non-replies.'],
  sales:      ['6 replies handled: 3 interested, 2 not now, 1 no.', '4 demos booked for this week.', 'Proposal drafted: answering + text-back bundle, 12-month term.'],
  onboarding: ['GHL sub-account, calendar and contacts set up.', 'Answering script built from intake form.', 'Number ported and forwarding live.'],
  delivery:   ['41 calls answered · 29 booked · 0 dropped.', '19 missed calls texted back in under 10s · 7 booked.', 'Scored 25 calls: pricing objection is the weak spot.'],
  success:    ['3 accounts flagged for low usage; outreach drafted.', 'Monthly reports sent: 212 calls saved across clients.', '22 review requests sent · 6 new 5-star reviews.'],
  finance:    ['18 invoices issued · $6,840 billed.', '4 of 6 failed cards recovered.', 'Cost per booked demo by niche: roofing lowest.'],
};

const REVISION_NOTES = [
  'Lead with what a missed call costs them, not with features.',
  'Too long — cut it under 90 words.',
  'Add a {city} proof point before the ask.',
  'Wrong niche wording — this list is {niche}, not HVAC.',
  'Numbers don\'t tie out to last week\'s report; recheck.',
  'Tone is too salesy for an existing client.',
  'Missing the after-hours angle — that\'s the hook for {niche}.',
];

const BLOCKERS = [
  'Waiting on client calendar access',
  'Carrier rejected the number port — needs a new LOA',
  'Ad account under review',
  'Missing pricing sheet for {niche}',
];

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

function taskFor(a: Agent) {
  const tpl = (a.slug && TASKS_BY_SLUG[a.slug]) || [`${a.title || 'Specialist'} task for {niche} clients in {city}`];
  return fillTemplate(pick(tpl));
}

function outputFor(a: Agent) {
  return pick(OUTPUTS[a.department] ?? ['Draft ready for review.']);
}

export function newSimState(): SimState {
  return { stage: {}, task: {}, workId: {}, work: [], seq: 0 };
}

type Ctx = { agents: Agent[]; byId: Record<string, Agent> };

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function mkEvent(st: SimState, e: Omit<AgentEvent, 'id' | 'created_at' | 'sim'>, offsetMs = 0): AgentEvent {
  st.seq += 1;
  return { ...e, id: `sim-${st.seq}-${Date.now()}`, created_at: nowIso(offsetMs), sim: true };
}

function upsertWork(st: SimState, w: Work) {
  const i = st.work.findIndex(x => x.id === w.id);
  if (i >= 0) st.work[i] = w;
  else st.work.unshift(w);
  if (st.work.length > 200) st.work.length = 200;
}

function currentWork(st: SimState, id: string) {
  return st.work.find(w => w.id === st.workId[id]);
}

function specialists(ctx: Ctx) {
  return ctx.agents.filter(a => a.tier === 'specialist' && a.status === 'active');
}

/** Start work for one specialist: CEO directive (sometimes) → manager handoff. */
function assign(st: SimState, ctx: Ctx, a: Agent): AgentEvent[] {
  const task = taskFor(a);
  const mgr = a.reports_to ? ctx.byId[a.reports_to] : undefined;
  const exec = mgr?.reports_to ? ctx.byId[mgr.reports_to] : undefined;
  const ceo = exec?.reports_to ? ctx.byId[exec.reports_to] : undefined;
  st.seq += 1;
  const id = `sim-w-${st.seq}`;
  st.stage[a.id] = 'working';
  st.task[a.id] = task;
  st.workId[a.id] = id;
  const now = nowIso();
  upsertWork(st, {
    id, agent_id: a.id, parent_id: null, title: task, brief: mgr ? `Assigned by ${mgr.name}` : '',
    output: '', status: 'in_progress', revision_count: 0, revision_notes: '', requested_by: null,
    completed_at: null, created_at: now, updated_at: now, sim: true,
  });
  const out: AgentEvent[] = [];
  if (exec && ceo && Math.random() < 0.3) {
    out.push(mkEvent(st, { agent_id: exec.id, to_agent_id: ceo.id, work_id: null, kind: 'directive',
      message: `${ceo.name} → ${exec.name}: ${fillTemplate(pick(['Push {niche} pipeline in {city} this week', 'Tighten response times on {niche} accounts', 'Protect margin on {niche} clients', 'Double down on what\'s booking in {city}']))}` }));
  }
  out.push(mkEvent(st, { agent_id: a.id, to_agent_id: mgr?.id ?? null, work_id: id, kind: 'handoff',
    message: `${mgr?.name ?? 'Manager'} assigned ${a.name}: ${task}` }));
  return out;
}

function advance(st: SimState, ctx: Ctx, a: Agent): AgentEvent[] {
  const stage = st.stage[a.id] ?? 'idle';
  const mgr = a.reports_to ? ctx.byId[a.reports_to] : undefined;
  const w = currentWork(st, a.id);
  const task = st.task[a.id] ?? '';
  const touch = (patch: Partial<Work>) => { if (w) upsertWork(st, { ...w, ...patch, updated_at: nowIso() }); };

  if (stage === 'idle') return assign(st, ctx, a);

  if (stage === 'blocked') {
    st.stage[a.id] = 'working';
    return [mkEvent(st, { agent_id: a.id, to_agent_id: null, work_id: w?.id ?? null, kind: 'progress', message: `${a.name} unblocked, back on: ${task}` })];
  }

  if (stage === 'working' || stage === 'revising') {
    if (stage === 'working' && Math.random() < 0.06) {
      st.stage[a.id] = 'blocked';
      return [mkEvent(st, { agent_id: a.id, to_agent_id: mgr?.id ?? null, work_id: w?.id ?? null, kind: 'alert', message: `${a.name} blocked: ${fillTemplate(pick(BLOCKERS))}` })];
    }
    if (stage === 'working' && Math.random() < 0.3) {
      return [mkEvent(st, { agent_id: a.id, to_agent_id: null, work_id: w?.id ?? null, kind: 'progress', message: `${a.name}: ${pick(['halfway there', 'first draft done, polishing', 'pulling data', 'checking against the brief'])} · ${task}` })];
    }
    st.stage[a.id] = 'in_review';
    const v = (w?.revision_count ?? 0) + 1;
    touch({ status: 'in_review', output: `${v > 1 ? `v${v}: ` : ''}${outputFor(a)}` });
    return [mkEvent(st, { agent_id: a.id, to_agent_id: mgr?.id ?? null, work_id: w?.id ?? null, kind: 'review',
      message: `${a.name} sent "${task}" to ${mgr?.name ?? 'manager'} for review${v > 1 ? ` (v${v})` : ''}` })];
  }

  // in_review: manager decides.
  const revisions = w?.revision_count ?? 0;
  if (Math.random() < (revisions === 0 ? 0.3 : 0.12)) {
    const note = fillTemplate(pick(REVISION_NOTES));
    st.stage[a.id] = 'revising';
    touch({ status: 'revision', revision_count: revisions + 1, revision_notes: note });
    return [mkEvent(st, { agent_id: a.id, to_agent_id: mgr?.id ?? null, work_id: w?.id ?? null, kind: 'revision',
      message: `${mgr?.name ?? 'Manager'} sent back "${task}" — revision #${revisions + 1}: ${note}` })];
  }
  st.stage[a.id] = 'idle';
  touch({ status: 'done', completed_at: nowIso() });
  return [mkEvent(st, { agent_id: a.id, to_agent_id: mgr?.id ?? null, work_id: w?.id ?? null, kind: 'done',
    message: `${mgr?.name ?? 'Manager'} approved ${a.name}'s "${task}"` })];
}

/** Opening state: most of the floor already busy, a few in review, one revision. */
export function seedSim(st: SimState, agents: Agent[]): AgentEvent[] {
  const ctx = { agents, byId: Object.fromEntries(agents.map(a => [a.id, a])) };
  const events: AgentEvent[] = [];
  for (const a of specialists(ctx)) {
    const r = Math.random();
    if (r < 0.2) continue;
    assign(st, ctx, a);
    if (r > 0.82) {
      events.push(...advance(st, ctx, a).filter(e => e.kind === 'review'));
    }
  }
  // Keep the opening feed short: a few recent-looking lines, newest first.
  return events.slice(-5).reverse();
}

export function stepSim(st: SimState, agents: Agent[]): AgentEvent[] {
  const ctx = { agents, byId: Object.fromEntries(agents.map(a => [a.id, a])) };
  const pool = specialists(ctx);
  if (pool.length === 0) return [];
  // Favour agents with work in flight so stories finish, but keep idle desks filling up.
  const busy = pool.filter(a => (st.stage[a.id] ?? 'idle') !== 'idle');
  const a = busy.length && Math.random() < 0.7 ? pick(busy) : pick(pool);
  return advance(st, ctx, a);
}

/** Per-agent activity the canvas should show while the simulation runs. */
export function simOverlay(st: SimState, agents: Agent[]): SimOverlay {
  const out: SimOverlay = {};
  const stageToActivity: Record<Stage, Activity> = {
    idle: 'idle', working: 'working', in_review: 'idle', revising: 'revising', blocked: 'blocked',
  };
  const reports: Record<string, Agent[]> = {};
  for (const a of agents) if (a.reports_to) (reports[a.reports_to] ??= []).push(a);

  for (const a of agents) {
    if (a.tier !== 'specialist') continue;
    const stage = st.stage[a.id] ?? 'idle';
    out[a.id] = { activity: stageToActivity[stage], task: stage === 'idle' ? '' : st.task[a.id] ?? '' };
  }
  for (const a of agents) {
    if (a.tier !== 'manager') continue;
    const team = reports[a.id] ?? [];
    const reviewing = team.find(t => st.stage[t.id] === 'in_review');
    const busy = team.some(t => (st.stage[t.id] ?? 'idle') !== 'idle');
    out[a.id] = reviewing
      ? { activity: 'reviewing', task: `Reviewing ${reviewing.name}: ${st.task[reviewing.id] ?? ''}` }
      : { activity: busy ? 'working' : 'idle', task: busy ? `Running ${team.length} agents` : '' };
  }
  for (const a of agents) {
    if (a.tier !== 'exec') continue;
    const mgrs = reports[a.id] ?? [];
    const busy = mgrs.filter(m => out[m.id]?.activity !== 'idle').length;
    out[a.id] = { activity: busy ? 'working' : 'idle', task: busy ? `Overseeing ${busy} of ${mgrs.length} departments` : '' };
  }
  for (const a of agents) {
    if (a.tier === 'ceo') out[a.id] = { activity: 'working', task: 'Directing the team' };
  }
  return out;
}

/** The founder approving or sending back a sample work item from the panel. */
export function simDecide(
  st: SimState, agents: Agent[], workId: string, decision: 'approve' | 'revise', notes = '',
): AgentEvent[] {
  const w = st.work.find(x => x.id === workId);
  const a = w && agents.find(x => x.id === w.agent_id);
  if (!w || !a) return [];
  const current = st.workId[a.id] === w.id;
  if (decision === 'approve') {
    upsertWork(st, { ...w, status: 'done', completed_at: nowIso(), updated_at: nowIso() });
    if (current) st.stage[a.id] = 'idle';
    return [mkEvent(st, { agent_id: a.id, to_agent_id: null, work_id: w.id, kind: 'done', message: `Founder approved ${a.name}'s "${w.title}"` })];
  }
  const n = w.revision_count + 1;
  upsertWork(st, { ...w, status: 'revision', revision_count: n, revision_notes: notes, updated_at: nowIso() });
  if (current) st.stage[a.id] = 'revising';
  return [mkEvent(st, { agent_id: a.id, to_agent_id: null, work_id: w.id, kind: 'revision',
    message: `Founder sent back "${w.title}" — revision #${n}${notes ? `: ${notes}` : ''}` })];
}
