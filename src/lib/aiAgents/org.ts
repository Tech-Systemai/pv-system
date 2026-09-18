import type { Agent, Department, Tier } from './types';

// The default Octopus Engines org. The HQ view previews it before any agent
// exists, and "Staff the building" writes it to ai_departments / ai_agents.
// `tasks` are sample assignments the simulation hands out; {niche} and {city}
// are filled at random so the feed reads like real multi-niche work.

type OrgAgent = {
  slug: string;
  name: string;
  title: string;
  tier: Tier;
  department?: string;
  reports_to?: string;
  channel: string;
  purpose: string;
  tasks: string[];
};

export const NICHES = ['HVAC', 'plumbing', 'roofing', 'electrical', 'pest control', 'garage door', 'landscaping'];
export const CITIES = ['Tampa', 'Orlando', 'Phoenix', 'Dallas', 'Atlanta', 'Charlotte', 'Houston', 'Nashville'];

export const DEFAULT_DEPARTMENTS: Department[] = [
  { key: 'lead-gen',   name: 'Lead Generation',        blurb: 'Finds and qualifies contractors in every niche',     arm_order: 0, hue: 22 },
  { key: 'content',    name: 'Content & Ads',          blurb: 'Ads, landing pages and organic content',             arm_order: 1, hue: 38 },
  { key: 'sales',      name: 'Sales & Booking',        blurb: 'Turns qualified leads into booked demos and deals',  arm_order: 2, hue: 330 },
  { key: 'answering',  name: '24/7 AI Answering',      blurb: 'Answers every client call, day and night',           arm_order: 3, hue: 190 },
  { key: 'textback',   name: 'Missed-Call Text-Back',  blurb: 'Texts back every missed call within seconds',        arm_order: 4, hue: 172 },
  { key: 'success',    name: 'Onboarding & Success',   blurb: 'Sets clients up and keeps them healthy',             arm_order: 5, hue: 210 },
  { key: 'billing',    name: 'Billing & Collections',  blurb: 'Invoices, payments and failed-card recovery',        arm_order: 6, hue: 140 },
  { key: 'finance',    name: 'Finance & Reporting',    blurb: 'Books, unit economics and spend control',            arm_order: 7, hue: 95 },
];

export const DEFAULT_AGENTS: OrgAgent[] = [
  // ── Leadership ──
  { slug: 'ceo', name: 'Atlas', title: 'Chief Executive Officer', tier: 'ceo', channel: 'other',
    purpose: 'Turns the founder\'s goals into direction for every department and keeps the arms working together.',
    tasks: ['Set this week\'s priorities: {niche} pipeline in {city}', 'Review cross-department scorecard', 'Break down founder request into department briefs'] },
  { slug: 'cmo', name: 'Coral', title: 'Chief Marketing Officer', tier: 'exec', reports_to: 'ceo', channel: 'other',
    purpose: 'Owns growth: lead generation, content and ads, sales and booking.',
    tasks: ['Rebalance ad spend toward {niche}', 'Approve {city} campaign plan', 'Review lead-to-demo conversion'] },
  { slug: 'coo', name: 'Tide', title: 'Chief Operating Officer', tier: 'exec', reports_to: 'ceo', channel: 'other',
    purpose: 'Owns service delivery: 24/7 answering, missed-call text-back, onboarding and client success.',
    tasks: ['Audit answer rate across {niche} clients', 'Approve onboarding checklist change', 'Review after-hours coverage'] },
  { slug: 'cfo', name: 'Ledger', title: 'Chief Financial Officer', tier: 'exec', reports_to: 'ceo', channel: 'other',
    purpose: 'Owns money: billing, collections, bookkeeping, margins and spend.',
    tasks: ['Review MRR movement this week', 'Approve {niche} pricing test', 'Check CAC payback by niche'] },

  // ── Lead Generation ──
  { slug: 'lead-mgr', name: 'Harbor', title: 'Lead Generation Manager', tier: 'manager', department: 'lead-gen', reports_to: 'cmo', channel: 'other',
    purpose: 'Runs the prospecting machine and hands qualified contractors to Sales.',
    tasks: ['Split {city} {niche} list across the team', 'QA this morning\'s lead batch'] },
  { slug: 'lead-scraper', name: 'Scout', title: 'Prospect Researcher', tier: 'specialist', department: 'lead-gen', reports_to: 'lead-mgr', channel: 'other',
    purpose: 'Builds prospect lists of home-service contractors from maps, directories and ads.',
    tasks: ['Build list: {niche} contractors in {city}', 'Enrich 200 {niche} owners with direct lines', 'Find {niche} shops running ads without an answering service'] },
  { slug: 'lead-email', name: 'Quill', title: 'Cold Email Writer', tier: 'specialist', department: 'lead-gen', reports_to: 'lead-mgr', channel: 'email',
    purpose: 'Writes and sends cold email sequences to contractor owners.',
    tasks: ['Write 3-step sequence for {niche} owners in {city}', 'A/B subject lines: missed-call angle', 'Reply-handle positive responses from {niche}'] },
  { slug: 'lead-caller', name: 'Dial', title: 'Outbound Caller', tier: 'specialist', department: 'lead-gen', reports_to: 'lead-mgr', channel: 'voice',
    purpose: 'Calls prospects to introduce Octopus Engines and gauge interest.',
    tasks: ['Call block: 40 {niche} shops in {city}', 'Follow-up calls on opened emails', 'Voicemail drop: after-hours pitch'] },
  { slug: 'lead-qualifier', name: 'Sieve', title: 'Lead Qualifier', tier: 'specialist', department: 'lead-gen', reports_to: 'lead-mgr', channel: 'sms',
    purpose: 'Scores leads on size, call volume and fit before they reach Sales.',
    tasks: ['Score today\'s {niche} replies', 'Qualify inbound form fills from {city}', 'Flag high-volume {niche} shops for fast-track'] },

  // ── Content & Ads ──
  { slug: 'content-mgr', name: 'Beacon', title: 'Content & Ads Manager', tier: 'manager', department: 'content', reports_to: 'cmo', channel: 'other',
    purpose: 'Plans campaigns per niche and signs off creative before it ships.',
    tasks: ['Plan {niche} campaign calendar', 'Review ad creative for {city}'] },
  { slug: 'content-ads', name: 'Hook', title: 'Ad Copywriter', tier: 'specialist', department: 'content', reports_to: 'content-mgr', channel: 'other',
    purpose: 'Writes paid ad copy for Meta and Google aimed at contractor owners.',
    tasks: ['Write 5 Meta ads: "never miss a {niche} call"', 'Google search ads for {niche} answering service', 'Retargeting copy for demo no-shows'] },
  { slug: 'content-pages', name: 'Canvas', title: 'Landing Page Builder', tier: 'specialist', department: 'content', reports_to: 'content-mgr', channel: 'other',
    purpose: 'Builds and tests niche landing pages.',
    tasks: ['Build landing page: {niche} missed-call text-back', 'Add {city} testimonials to {niche} page', 'Speed-fix the demo booking page'] },
  { slug: 'content-social', name: 'Echo Reel', title: 'Social Content Creator', tier: 'specialist', department: 'content', reports_to: 'content-mgr', channel: 'other',
    purpose: 'Makes short-form posts and case-study clips.',
    tasks: ['Script 3 reels: {niche} owner losing calls', 'Case study post: {city} {niche} client', 'Weekly LinkedIn carousel'] },

  // ── Sales & Booking ──
  { slug: 'sales-mgr', name: 'Anchor', title: 'Sales Manager', tier: 'manager', department: 'sales', reports_to: 'cmo', channel: 'other',
    purpose: 'Owns the pipeline from qualified lead to signed client.',
    tasks: ['Pipeline review: {niche} deals', 'Coach demo script for {niche}'] },
  { slug: 'sales-booker', name: 'Clasp', title: 'Demo Booker', tier: 'specialist', department: 'sales', reports_to: 'sales-mgr', channel: 'voice',
    purpose: 'Books qualified contractors onto demo calls.',
    tasks: ['Book demos from {niche} hot list', 'Reschedule {city} no-shows', 'Confirm tomorrow\'s demos by text'] },
  { slug: 'sales-followup', name: 'Tether', title: 'Follow-up Agent', tier: 'specialist', department: 'sales', reports_to: 'sales-mgr', channel: 'sms',
    purpose: 'Chases warm leads and post-demo decisions.',
    tasks: ['Day-3 follow-up: {niche} demos', 'Send ROI recap to {city} prospect', 'Revive stalled {niche} deals'] },
  { slug: 'sales-proposal', name: 'Pact', title: 'Proposal Writer', tier: 'specialist', department: 'sales', reports_to: 'sales-mgr', channel: 'email',
    purpose: 'Drafts proposals and pricing for each prospect.',
    tasks: ['Proposal: 3-truck {niche} shop in {city}', 'Bundle quote: answering + text-back', 'Annual plan offer for {niche}'] },

  // ── 24/7 AI Answering ──
  { slug: 'answer-mgr', name: 'Echo', title: 'Answering Service Manager', tier: 'manager', department: 'answering', reports_to: 'coo', channel: 'other',
    purpose: 'Keeps every client line answered and every script sharp.',
    tasks: ['Review call scripts for {niche} clients', 'Coverage check: overnight lines'] },
  { slug: 'answer-reception', name: 'Lumen', title: 'Inbound Receptionist', tier: 'specialist', department: 'answering', reports_to: 'answer-mgr', channel: 'voice',
    purpose: 'Answers client calls, captures the job and books the appointment.',
    tasks: ['Live lines: {city} {niche} clients', 'Book service calls into client calendars', 'Capture job details for {niche} emergencies'] },
  { slug: 'answer-dispatch', name: 'Nightowl', title: 'After-Hours Dispatcher', tier: 'specialist', department: 'answering', reports_to: 'answer-mgr', channel: 'voice',
    purpose: 'Handles after-hours emergencies and pages on-call techs.',
    tasks: ['Overnight emergency line: {niche}', 'Page on-call tech for {city} client', 'Log after-hours call summary'] },
  { slug: 'answer-qa', name: 'Tuner', title: 'Call QA Reviewer', tier: 'specialist', department: 'answering', reports_to: 'answer-mgr', channel: 'other',
    purpose: 'Scores call recordings and suggests script fixes.',
    tasks: ['Score 25 calls from {niche} clients', 'Rewrite pricing objection answer', 'Flag calls that missed a booking'] },

  // ── Missed-Call Text-Back ──
  { slug: 'text-mgr', name: 'Ripple', title: 'Text-Back Manager', tier: 'manager', department: 'textback', reports_to: 'coo', channel: 'other',
    purpose: 'Makes sure every missed call becomes a conversation.',
    tasks: ['Tune text-back templates for {niche}', 'Review reply rates by client'] },
  { slug: 'text-responder', name: 'Spark', title: 'Text-Back Responder', tier: 'specialist', department: 'textback', reports_to: 'text-mgr', channel: 'sms',
    purpose: 'Texts callers back seconds after a missed call and keeps the thread going.',
    tasks: ['Missed calls: {city} {niche} clients', 'Continue open threads from this morning', 'Answer pricing questions by text'] },
  { slug: 'text-setter', name: 'Latch', title: 'Appointment Setter', tier: 'specialist', department: 'textback', reports_to: 'text-mgr', channel: 'sms',
    purpose: 'Turns text conversations into booked jobs.',
    tasks: ['Book jobs from text threads: {niche}', 'Offer next-day slots in {city}', 'Confirm and remind booked customers'] },
  { slug: 'text-reviews', name: 'Star', title: 'Review Requester', tier: 'specialist', department: 'textback', reports_to: 'text-mgr', channel: 'sms',
    purpose: 'Asks happy customers of our clients for Google reviews.',
    tasks: ['Review requests: completed {niche} jobs', 'Follow up unreviewed {city} jobs', 'Route unhappy replies to client owner'] },

  // ── Onboarding & Success ──
  { slug: 'success-mgr', name: 'Keel', title: 'Client Success Manager', tier: 'manager', department: 'success', reports_to: 'coo', channel: 'other',
    purpose: 'Onboards new clients and keeps accounts healthy and renewing.',
    tasks: ['Kickoff plan: new {niche} client', 'Weekly health review'] },
  { slug: 'success-setup', name: 'Rig', title: 'Onboarding Specialist', tier: 'specialist', department: 'success', reports_to: 'success-mgr', channel: 'email',
    purpose: 'Sets up numbers, forwarding, scripts and calendars for new clients.',
    tasks: ['Port number + forwarding: {city} {niche} client', 'Build call script from intake form', 'Connect client calendar'] },
  { slug: 'success-health', name: 'Pulse', title: 'Account Health Monitor', tier: 'specialist', department: 'success', reports_to: 'success-mgr', channel: 'other',
    purpose: 'Watches usage and flags accounts at risk.',
    tasks: ['Flag low-usage {niche} accounts', 'Monthly results report: {city} client', 'Spot churn signals this week'] },
  { slug: 'success-support', name: 'Buoy', title: 'Support Desk', tier: 'specialist', department: 'success', reports_to: 'success-mgr', channel: 'chat',
    purpose: 'Answers client questions and fixes small issues.',
    tasks: ['Resolve script change request', 'Update business hours for {niche} client', 'Answer billing question from {city} client'] },

  // ── Billing & Collections ──
  { slug: 'billing-mgr', name: 'Mint', title: 'Billing Manager', tier: 'manager', department: 'billing', reports_to: 'cfo', channel: 'other',
    purpose: 'Keeps invoices accurate and cash coming in.',
    tasks: ['Month-end billing run', 'Review failed payments'] },
  { slug: 'billing-invoice', name: 'Stamp', title: 'Invoice Agent', tier: 'specialist', department: 'billing', reports_to: 'billing-mgr', channel: 'email',
    purpose: 'Issues invoices and usage charges.',
    tasks: ['Invoice {niche} clients: usage overages', 'Send annual renewals', 'Correct {city} client invoice'] },
  { slug: 'billing-collect', name: 'Reel', title: 'Collections Agent', tier: 'specialist', department: 'billing', reports_to: 'billing-mgr', channel: 'sms',
    purpose: 'Recovers failed cards and overdue balances, politely.',
    tasks: ['Retry failed cards: 6 accounts', 'Dunning texts: 30-day overdue', 'Payment plan offer for {niche} client'] },

  // ── Finance & Reporting ──
  { slug: 'finance-mgr', name: 'Abacus', title: 'Finance Manager', tier: 'manager', department: 'finance', reports_to: 'cfo', channel: 'other',
    purpose: 'Closes the books and reports the numbers that matter.',
    tasks: ['Weekly close', 'Board-style snapshot for the founder'] },
  { slug: 'finance-books', name: 'Tally', title: 'Bookkeeper', tier: 'specialist', department: 'finance', reports_to: 'finance-mgr', channel: 'other',
    purpose: 'Categorises transactions and reconciles accounts.',
    tasks: ['Reconcile Stripe payouts', 'Categorise this week\'s expenses', 'Match Twilio invoices to usage'] },
  { slug: 'finance-analyst', name: 'Gauge', title: 'Unit Economics Analyst', tier: 'specialist', department: 'finance', reports_to: 'finance-mgr', channel: 'other',
    purpose: 'Tracks CAC, LTV, margin and payback by niche.',
    tasks: ['CAC by niche: {niche} vs rest', 'Gross margin per client: telephony costs', 'Payback period for {city} campaign'] },
  { slug: 'finance-spend', name: 'Sentry', title: 'Spend Auditor', tier: 'specialist', department: 'finance', reports_to: 'finance-mgr', channel: 'other',
    purpose: 'Watches software, ad and telephony spend for waste.',
    tasks: ['Audit ad spend vs booked demos', 'Find unused software seats', 'Flag telephony cost spikes'] },
];

export const TASKS_BY_SLUG: Record<string, string[]> = Object.fromEntries(
  DEFAULT_AGENTS.map(a => [a.slug, a.tasks]),
);

export function fillTemplate(t: string, rnd: () => number = Math.random) {
  const pick = (xs: string[]) => xs[Math.floor(rnd() * xs.length)];
  return t.replace(/\{niche\}/g, () => pick(NICHES)).replace(/\{city\}/g, () => pick(CITIES));
}

/** Preview rows for the default org, keyed by slug, used before the DB is staffed. */
export function previewAgents(): Agent[] {
  const now = new Date().toISOString();
  return DEFAULT_AGENTS.map((a, i) => ({
    id: a.slug,
    slug: a.slug,
    name: a.name,
    title: a.title,
    tier: a.tier,
    department: a.department ?? '',
    reports_to: a.reports_to ?? null,
    purpose: a.purpose,
    channel: a.channel,
    status: 'active',
    model: '',
    system_prompt: '',
    activity: 'idle',
    current_task: '',
    last_active_at: null,
    sort_order: i,
    config: {},
    created_at: now,
  }));
}

/** Rows to insert when staffing the building. IDs are minted here so
 *  reports_to can point at them inside the same insert. */
export function staffingRows(createdBy: string) {
  const ids = Object.fromEntries(DEFAULT_AGENTS.map(a => [a.slug, crypto.randomUUID()]));
  return DEFAULT_AGENTS.map((a, i) => ({
    id: ids[a.slug],
    slug: a.slug,
    name: a.name,
    title: a.title,
    tier: a.tier,
    department: a.department ?? '',
    reports_to: a.reports_to ? ids[a.reports_to] : null,
    purpose: a.purpose,
    channel: a.channel,
    status: 'active',
    activity: 'idle',
    sort_order: i,
    created_by: createdBy,
  }));
}
