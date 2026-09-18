import { CITIES, NICHE_PROFILE } from './org';
import { QUALIFY_AT, channelStats, checkEmail, identifyChannel, personalize, scoreWillingness, talkingPoints } from './pipeline';
import type { Agent, AgentEvent, EventKind, Lead, LeadSignals, Niche, Outreach, OutreachStatus } from './types';

// Sample leads flowing through the real pipeline rules: Google Maps pull →
// research (score + channel) → call list or email draft → compliance → send →
// replies. Nothing here is stored; every row is flagged `sim`. Scoring, the
// channel decision and the compliance check are the production functions, so
// the sample shows exactly how real leads will be judged.

export type PipeState = {
  leads: Lead[];
  outreach: Outreach[];
  seq: number;
  tick: number;
  busy: Record<string, { task: string; until: number }>;
  nagged: Record<string, number>;
};

export function newPipeState(): PipeState {
  return { leads: [], outreach: [], seq: 0, tick: 0, busy: {}, nagged: {} };
}

const SURNAMES = ['Rivera', 'Summit', 'Patel', 'Blue Ridge', 'Carter', 'Ironwood', 'Nguyen', 'Lone Star', 'Brooks', 'Sunbelt', 'Kowalski', 'Evergreen', 'Delgado', 'Precision', 'Harper', 'Anchor', 'Whitaker', 'Coastal', 'Morales', 'Pioneer'];
const FIRST = ['Mike', 'Carlos', 'Dave', 'Jason', 'Luis', 'Brian', 'Tony', 'Kevin', 'Ray', 'Steve', 'Maria', 'Chris', 'Derek', 'Sam'];
const NICHE_WORD: Record<string, string[]> = {
  plumbing: ['Plumbing', 'Plumbing & Drain', 'Rooter'],
  hvac: ['Heating & Air', 'HVAC', 'Air Conditioning'],
  electrical: ['Electric', 'Electrical Services', 'Electric Co'],
  garage_door: ['Garage Doors', 'Overhead Door', 'Garage Door Repair'],
  restoration: ['Restoration', 'Water & Fire Restoration', 'Disaster Restoration'],
  roofing: ['Roofing', 'Roofing & Exteriors', 'Roof Systems'],
  remodeling: ['Kitchen & Bath', 'Remodeling', 'Home Renovations'],
  pools: ['Pools', 'Custom Pools', 'Pool & Spa'],
  windows: ['Windows & Doors', 'Window Co', 'Glass & Doors'],
  landscaping: ['Landscaping', 'Lawn & Landscape', 'Outdoor Living'],
};
const AREA = ['813', '407', '602', '214', '404', '704', '713', '615', '303', '919'];
const REPLIES = ['"How much is it per month?"', '"Send me more info."', '"We already have an answering service, what makes yours different?"', '"Call me Thursday afternoon."', '"Is this AI? My customers hate robots."', '"Interested — what does setup look like?"'];

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const chance = (p: number) => Math.random() < p;
const now = () => new Date().toISOString();

function slugOf(name: string) {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
}

function fakeLead(st: PipeState, niche: Niche, city: string): Lead {
  const prof = NICHE_PROFILE[niche.key] ?? { emergency: false, highTicket: false, officeStaff: 0.4 };
  const name = `${pick(SURNAMES)} ${pick(NICHE_WORD[niche.key] ?? [niche.name])}`;
  const owner = `${pick(FIRST)} ${pick(SURNAMES.filter(s => !s.includes(' ')))}`;
  const staff = Math.max(1, Math.round(Math.random() * Math.random() * 12));
  const hasSite = chance(0.78);
  const officeStaff = staff >= 4 && chance(prof.officeStaff + 0.2);
  const emailType: LeadSignals['email_type'] = !hasSite ? (chance(0.2) ? 'generic' : 'none')
    : chance(officeStaff ? 0.35 : 0.45) ? 'owner' : chance(0.6) ? 'generic' : 'none';
  const domain = `${slugOf(name)}.com`;
  const reviews = Math.round(Math.pow(Math.random(), 1.6) * 260);
  st.seq += 1;
  return {
    id: `sim-lead-${st.seq}`,
    niche: niche.key,
    business_name: name,
    owner_name: owner,
    city,
    state: '',
    phone: `(${pick(AREA)}) 555-${String(100 + Math.floor(Math.random() * 899)).padStart(4, '0')}`,
    email: emailType === 'owner' ? `${owner.split(' ')[0].toLowerCase()}@${domain}` : emailType === 'generic' ? `info@${domain}` : '',
    website: hasSite ? domain : '',
    rating: Math.round((3.4 + Math.random() * 1.6) * 10) / 10,
    review_count: reviews,
    source: 'google_maps',
    signals: {
      email_type: emailType,
      has_website: hasSite,
      runs_ads: chance(0.35 + (staff >= 4 ? 0.2 : 0)),
      hours_24_7: prof.emergency ? chance(0.55) : chance(0.08),
      staff_estimate: staff,
      office_staff: officeStaff,
      missed_call_reviews: chance(0.28),
      years_in_business: 1 + Math.floor(Math.random() * 25),
    },
    status: 'new',
    wtp_score: null,
    wtp_reasons: [],
    contact_channel: null,
    channel_confidence: null,
    channel_reasons: [],
    talking_points: [],
    researched_by: null,
    researched_at: null,
    created_at: now(),
    updated_at: now(),
    sim: true,
  };
}

type Ctx = { agents: Agent[]; niches: Niche[] };

function agentBySlug(ctx: Ctx, slug: string) {
  return ctx.agents.find(a => a.slug === slug && a.status === 'active');
}

function ev(st: PipeState, ctx: Ctx, slug: string, kind: EventKind, message: string, task?: string): AgentEvent | null {
  const a = agentBySlug(ctx, slug);
  if (!a) return null;
  st.seq += 1;
  if (task) st.busy[a.id] = { task, until: st.tick + 3 };
  return { id: `sim-p-${st.seq}-${Date.now()}`, agent_id: a.id, to_agent_id: null, work_id: null, kind, message: message.replace(/\{agent\}/g, a.name), created_at: now(), sim: true };
}

function setLead(st: PipeState, id: string, patch: Partial<Lead>) {
  const i = st.leads.findIndex(l => l.id === id);
  if (i >= 0) st.leads[i] = { ...st.leads[i], ...patch, updated_at: now() };
}

function setOutreach(st: PipeState, id: string, patch: Partial<Outreach>) {
  const i = st.outreach.findIndex(o => o.id === id);
  if (i >= 0) st.outreach[i] = { ...st.outreach[i], ...patch, updated_at: now() };
}

function addOutreach(st: PipeState, lead: Lead, channel: Outreach['channel'], status: OutreachStatus, extra: Partial<Outreach>, agentId: string | null): Outreach {
  st.seq += 1;
  const o: Outreach = {
    id: `sim-o-${st.seq}`, lead_id: lead.id, channel, status, subject: '', body: '', compliance_issues: [], notes: '',
    agent_id: agentId, sent_at: null, replied_at: null, created_at: now(), updated_at: now(), sim: true, ...extra,
  };
  st.outreach.unshift(o);
  return o;
}

const SAMPLE_SENDER = { name: 'Hamed', address: '(sample address) 100 Main St, Suite 200, Tampa, FL 33602' };

// ── Actions ────────────────────────────────────────────────────────────────────

function scrape(st: PipeState, ctx: Ctx) {
  const active = ctx.niches.filter(n => n.active);
  if (!active.length) return [];
  const niche = pick(active);
  const cities = niche.cities.split(',').map(c => c.trim()).filter(Boolean);
  const city = pick(cities.length ? cities : CITIES);
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) st.leads.unshift(fakeLead(st, niche, city));
  const e = ev(st, ctx, 'leadgen-maps', 'progress', `{agent} pulled ${n} ${niche.name} businesses in ${city} from Google Maps`, `Pull ${niche.name} in ${city}`);
  return e ? [e] : [];
}

function research(st: PipeState, ctx: Ctx) {
  const lead = [...st.leads].reverse().find(l => l.status === 'new');
  if (!lead) return [];
  const niche = ctx.niches.find(n => n.key === lead.niche);
  const { score, reasons } = scoreWillingness(lead);
  const ch = identifyChannel(lead, niche, channelStats(lead.niche, st.leads, st.outreach));
  const qualified = score >= QUALIFY_AT;
  const researcher = agentBySlug(ctx, 'research-qualifier');
  setLead(st, lead.id, {
    status: qualified ? 'qualified' : 'disqualified',
    wtp_score: score, wtp_reasons: reasons,
    contact_channel: ch.channel, channel_confidence: ch.confidence, channel_reasons: ch.reasons,
    talking_points: ch.channel === 'call' ? talkingPoints(lead) : [],
    researched_by: researcher?.id ?? null, researched_at: now(),
  });
  const top = ch.reasons[0]?.text.toLowerCase() ?? '';
  const e = qualified
    ? ev(st, ctx, 'research-qualifier', 'handoff', `{agent} qualified ${lead.business_name} (${score}/100) · ${ch.channel} first — ${top}`, `Qualify ${lead.business_name}`)
    : ev(st, ctx, 'research-qualifier', 'progress', `{agent} passed on ${lead.business_name} (${score}/100) — ${reasons.find(r => r.weight < 0)?.text.toLowerCase() ?? 'low willingness to pay'}`, `Qualify ${lead.business_name}`);
  return e ? [e] : [];
}

function prepareOutreach(st: PipeState, ctx: Ctx) {
  const lead = [...st.leads].reverse().find(l => l.status === 'qualified' && !st.outreach.some(o => o.lead_id === l.id));
  if (!lead) return [];
  const niche = ctx.niches.find(n => n.key === lead.niche);
  if (lead.contact_channel === 'call') {
    const writer = agentBySlug(ctx, 'research-callprep');
    addOutreach(st, lead, 'call', 'to_call', { notes: '' }, writer?.id ?? null);
    const e = ev(st, ctx, 'research-callprep', 'request', `{agent} added ${lead.business_name} to your call list · ${niche?.name ?? lead.niche}`, `Call sheet: ${lead.business_name}`);
    return e ? [e] : [];
  }
  const writer = agentBySlug(ctx, 'outreach-writer');
  const nicheForCopy = { name: niche?.name ?? lead.niche, ghl_url: niche?.ghl_url || `(your ${niche?.name ?? lead.niche} GHL page)` };
  let subject = personalize(niche?.template_subject ?? 'Missed calls at {business}?', lead, nicheForCopy, SAMPLE_SENDER);
  const body = personalize(niche?.template_body ?? '', lead, nicheForCopy, SAMPLE_SENDER);
  // Now and then the writer slips, so the compliance gate has something to catch.
  if (chance(0.12)) subject = `Re: ${subject}`;
  addOutreach(st, lead, 'email', 'compliance', { subject, body }, writer?.id ?? null);
  const e = ev(st, ctx, 'outreach-writer', 'handoff', `{agent} drafted an email to ${lead.business_name} — sent to Compliance`, `Email: ${lead.business_name}`);
  return e ? [e] : [];
}

function compliance(st: PipeState, ctx: Ctx) {
  const o = [...st.outreach].reverse().find(x => x.status === 'compliance');
  if (!o) return [];
  const lead = st.leads.find(l => l.id === o.lead_id);
  const issues = checkEmail(o.subject, o.body);
  setOutreach(st, o.id, { status: issues.length ? 'blocked' : 'scheduled', compliance_issues: issues });
  const e = issues.length
    ? ev(st, ctx, 'compliance-email', 'alert', `{agent} blocked the email to ${lead?.business_name}: ${issues[0]}`, `Check: ${lead?.business_name}`)
    : ev(st, ctx, 'compliance-email', 'progress', `{agent} cleared the email to ${lead?.business_name}`, `Check: ${lead?.business_name}`);
  return e ? [e] : [];
}

function send(st: PipeState, ctx: Ctx) {
  const ready = st.outreach.filter(o => o.status === 'scheduled');
  const nicheOf = (o: Outreach) => ctx.niches.find(n => n.key === st.leads.find(l => l.id === o.lead_id)?.niche);
  const sendable = ready.find(o => nicheOf(o)?.template_approved);
  if (sendable) {
    const lead = st.leads.find(l => l.id === sendable.lead_id);
    setOutreach(st, sendable.id, { status: 'sent', sent_at: now() });
    if (lead) setLead(st, lead.id, { status: 'contacted' });
    const e = ev(st, ctx, 'outreach-sender', 'progress', `{agent} sent the email to ${lead?.business_name} (sample — no email really sent)`, `Send: ${lead?.business_name}`);
    return e ? [e] : [];
  }
  // Waiting on the founder: say so once in a while per niche, not every tick.
  const waiting = ready.map(nicheOf).find(n => n && !n.template_approved && (st.nagged[n.key] ?? -99) < st.tick - 25);
  if (!waiting) return [];
  st.nagged[waiting.key] = st.tick;
  const count = ready.filter(o => nicheOf(o)?.key === waiting.key).length;
  const e = ev(st, ctx, 'outreach-mgr', 'alert', `${count} ${waiting.name} email${count === 1 ? '' : 's'} ready but waiting — approve the ${waiting.name} template in Niches to start sending`);
  return e ? [e] : [];
}

function replies(st: PipeState, ctx: Ctx) {
  const sent = st.outreach.filter(o => o.status === 'sent');
  if (!sent.length) return [];
  const o = pick(sent);
  if (!chance(0.35)) return [];
  const lead = st.leads.find(l => l.id === o.lead_id);
  const reply = pick(REPLIES);
  setOutreach(st, o.id, { status: 'replied', replied_at: now(), notes: reply });
  if (lead) setLead(st, lead.id, { status: 'replied' });
  const e = ev(st, ctx, 'sales-replies', 'handoff', `${lead?.business_name} replied: ${reply} — {agent} is handling it`, `Reply: ${lead?.business_name}`);
  return e ? [e] : [];
}

export function stepPipeline(st: PipeState, agents: Agent[], niches: Niche[]): AgentEvent[] {
  const ctx = { agents, niches };
  st.tick += 1;
  const count = (f: (l: Lead) => boolean) => st.leads.filter(f).length;
  const newLeads = count(l => l.status === 'new');
  const toPrep = count(l => l.status === 'qualified' && !st.outreach.some(o => o.lead_id === l.id));
  const inCompliance = st.outreach.filter(o => o.status === 'compliance').length;
  const scheduled = st.outreach.filter(o => o.status === 'scheduled').length;
  const sent = st.outreach.filter(o => o.status === 'sent').length;

  const options: [number, () => AgentEvent[]][] = [
    [newLeads < 6 ? 3 : st.leads.length > 400 ? 0 : 0.6, () => scrape(st, ctx)],
    [newLeads ? 4 : 0, () => research(st, ctx)],
    [toPrep ? 3 : 0, () => prepareOutreach(st, ctx)],
    [inCompliance ? 3 : 0, () => compliance(st, ctx)],
    [scheduled ? 2 : 0, () => send(st, ctx)],
    [sent ? 1.5 : 0, () => replies(st, ctx)],
  ];
  const total = options.reduce((t, [w]) => t + w, 0);
  let r = Math.random() * total;
  for (const [w, run] of options) {
    if ((r -= w) <= 0 && w > 0) return run();
  }
  return [];
}

/** A running start so the tabs are not empty on first load. */
export function seedPipeline(st: PipeState, agents: Agent[], niches: Niche[]) {
  for (let i = 0; i < 70; i++) stepPipeline(st, agents, niches);
  st.busy = {};
}

/** The founder logging the result of a call from the call list. */
export function simLogCall(st: PipeState, outreachId: string, status: OutreachStatus, notes: string) {
  const o = st.outreach.find(x => x.id === outreachId);
  if (!o) return;
  setOutreach(st, o.id, { status, notes, sent_at: o.sent_at ?? now() });
  const leadStatus = status === 'booked' ? 'booked' : status === 'not_interested' ? 'not_interested' : status === 'interested' ? 'replied' : 'contacted';
  setLead(st, o.lead_id, { status: leadStatus });
}

export function pipelineOverlay(st: PipeState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, b] of Object.entries(st.busy)) if (b.until > st.tick) out[id] = b.task;
  return out;
}
