import type { Agent, Department, Niche, Tier } from './types';

// The default Octopus Engines org, laid out as a building. Floors run top-down
// in the order a lead travels: leadership, then the pipeline (marketing →
// sales), then the client side, with Finance at the base. "Staff the building"
// writes this to ai_departments / ai_agents / ai_niches; before that the HQ
// previews it. `tasks` are sample assignments for the simulation; {niche} and
// {city} are filled at random.

type OrgAgent = {
  slug: string;
  name: string;
  title: string;
  tier: Tier;
  department: string;
  reports_to?: string;
  channel: string;
  purpose: string;
  tasks: string[];
};

export const CITIES = ['Tampa', 'Orlando', 'Phoenix', 'Dallas', 'Atlanta', 'Charlotte', 'Houston', 'Nashville', 'Denver', 'Raleigh'];

// arm_order is the floor, 0 = top.
export const DEFAULT_DEPARTMENTS: Department[] = [
  { key: 'exec',        name: 'Executive',               blurb: 'Sets direction and signs off on what matters',           arm_order: 0,  hue: 280 },
  { key: 'ops',         name: 'Operations Managers',     blurb: 'Keeps every floor on schedule and moves work between them', arm_order: 1,  hue: 250 },
  { key: 'marketing',   name: 'Marketing',               blurb: 'Brand, ads and content across every niche',              arm_order: 2,  hue: 22 },
  { key: 'funnels',     name: 'Funnels & Landing Pages', blurb: 'One GoHighLevel page per niche, built and tested',       arm_order: 3,  hue: 38 },
  { key: 'leadgen',     name: 'Lead Generation',         blurb: 'Pulls businesses in each niche from Google Maps',        arm_order: 4,  hue: 55 },
  { key: 'research',    name: 'Research',                blurb: 'Qualifies leads and decides call or email',              arm_order: 5,  hue: 150 },
  { key: 'compliance',  name: 'Compliance',              blurb: 'Checks every message against email, SMS and call rules', arm_order: 6,  hue: 0 },
  { key: 'outreach',    name: 'Outreach',                blurb: 'Personalises, sends and follows up',                     arm_order: 7,  hue: 200 },
  { key: 'sales',       name: 'Sales',                   blurb: 'Handles replies, books demos and closes',                arm_order: 8,  hue: 330 },
  { key: 'onboarding',  name: 'Onboarding',              blurb: 'Sets new clients up and live',                           arm_order: 9,  hue: 185 },
  { key: 'delivery',    name: 'Service Delivery',        blurb: '24/7 AI answering and missed-call text-back',            arm_order: 10, hue: 170 },
  { key: 'success',     name: 'Client Success',          blurb: 'Keeps clients using it, happy and renewing',             arm_order: 11, hue: 210 },
  { key: 'finance',     name: 'Finance',                 blurb: 'Billing, collections and the numbers',                   arm_order: 12, hue: 95 },
];

export const DEFAULT_AGENTS: OrgAgent[] = [
  // ── Executive ──
  { slug: 'ceo', name: 'Atlas', title: 'Chief Executive Officer', tier: 'ceo', department: 'exec', channel: 'other',
    purpose: 'Turns the founder\'s goals into direction for every floor.',
    tasks: ['Set this week\'s priority: {niche} in {city}', 'Review the pipeline scorecard', 'Break down founder request into floor briefs'] },
  { slug: 'coo', name: 'Tide', title: 'Chief Operating Officer', tier: 'exec', department: 'exec', reports_to: 'ceo', channel: 'other',
    purpose: 'Owns operations, compliance and everything clients experience after they sign.',
    tasks: ['Review onboarding backlog', 'Audit answer rate across {niche} clients', 'Approve compliance policy change'] },
  { slug: 'cmo', name: 'Coral', title: 'Chief Marketing Officer', tier: 'exec', department: 'exec', reports_to: 'ceo', channel: 'other',
    purpose: 'Owns the pipeline: marketing, funnels, lead gen, research, outreach and sales.',
    tasks: ['Rebalance effort toward {niche}', 'Review lead-to-demo conversion', 'Approve {city} campaign plan'] },
  { slug: 'cfo', name: 'Ledger', title: 'Chief Financial Officer', tier: 'exec', department: 'exec', reports_to: 'ceo', channel: 'other',
    purpose: 'Owns money: billing, collections, costs and margins.',
    tasks: ['Review MRR movement', 'Check cost per booked demo by niche', 'Approve {niche} pricing test'] },

  // ── Operations Managers ──
  { slug: 'ops-director', name: 'Helm', title: 'Operations Director', tier: 'manager', department: 'ops', reports_to: 'coo', channel: 'other',
    purpose: 'Runs the daily stand-up across floors and unblocks stuck work.',
    tasks: ['Daily stand-up across floors', 'Unblock stalled {niche} work'] },
  { slug: 'ops-pipeline', name: 'Relay', title: 'Pipeline Coordinator', tier: 'specialist', department: 'ops', reports_to: 'ops-director', channel: 'other',
    purpose: 'Moves leads between Lead Gen, Research, Outreach and Sales without gaps.',
    tasks: ['Hand qualified {niche} leads to Outreach', 'Chase leads stuck in research', 'Balance research load across niches'] },
  { slug: 'ops-quality', name: 'Level', title: 'Quality Controller', tier: 'specialist', department: 'ops', reports_to: 'ops-director', channel: 'other',
    purpose: 'Spot-checks agent output on every floor before it counts.',
    tasks: ['Spot-check 10 {niche} research scores', 'Review this week\'s revision rate', 'Audit call sheets for accuracy'] },
  { slug: 'ops-capacity', name: 'Tempo', title: 'Capacity Planner', tier: 'specialist', department: 'ops', reports_to: 'ops-director', channel: 'other',
    purpose: 'Plans how much each floor can take on and where to add agents.',
    tasks: ['Forecast lead volume for {niche}', 'Plan send capacity per inbox', 'Flag overloaded floors'] },

  // ── Marketing ──
  { slug: 'mkt-mgr', name: 'Beacon', title: 'Marketing Manager', tier: 'manager', department: 'marketing', reports_to: 'cmo', channel: 'other',
    purpose: 'Plans campaigns per niche and signs off creative.',
    tasks: ['Plan {niche} campaign calendar', 'Review ad creative for {city}'] },
  { slug: 'mkt-ads', name: 'Hook', title: 'Ad Copywriter', tier: 'specialist', department: 'marketing', reports_to: 'mkt-mgr', channel: 'other',
    purpose: 'Writes paid ads aimed at home-service owners.',
    tasks: ['Write 5 Meta ads: "never miss a {niche} call"', 'Google ads for {niche} answering service', 'Retargeting copy for demo no-shows'] },
  { slug: 'mkt-social', name: 'Reel', title: 'Social Content Creator', tier: 'specialist', department: 'marketing', reports_to: 'mkt-mgr', channel: 'other',
    purpose: 'Short-form posts and clips for owners scrolling after hours.',
    tasks: ['Script 3 reels: {niche} owner losing calls', 'Weekly LinkedIn carousel', 'Before/after post for {niche}'] },
  { slug: 'mkt-proof', name: 'Canvas', title: 'Case Study Writer', tier: 'specialist', department: 'marketing', reports_to: 'mkt-mgr', channel: 'other',
    purpose: 'Turns client results into proof for pages and outreach.',
    tasks: ['Case study: {city} {niche} client', 'Pull 3 quotable results for {niche}', 'Update proof library'] },

  // ── Funnels & Landing Pages ──
  { slug: 'funnels-mgr', name: 'Keystone', title: 'Funnels Manager', tier: 'manager', department: 'funnels', reports_to: 'cmo', channel: 'other',
    purpose: 'Owns one GoHighLevel landing page per niche and its conversion rate.',
    tasks: ['Review {niche} page conversion', 'Plan next page test'] },
  { slug: 'funnels-builder', name: 'Frame', title: 'GHL Page Builder', tier: 'specialist', department: 'funnels', reports_to: 'funnels-mgr', channel: 'other',
    purpose: 'Builds and updates niche landing pages in GoHighLevel.',
    tasks: ['Build GHL page: {niche}', 'Add booking calendar to {niche} page', 'Mobile fixes on {niche} page'] },
  { slug: 'funnels-copy', name: 'Pitch', title: 'Page Copywriter', tier: 'specialist', department: 'funnels', reports_to: 'funnels-mgr', channel: 'other',
    purpose: 'Writes landing page copy in each trade\'s language.',
    tasks: ['Hero + offer copy for {niche}', 'FAQ section for {niche}', 'Rewrite {niche} pricing block'] },
  { slug: 'funnels-cro', name: 'Split', title: 'Conversion Tester', tier: 'specialist', department: 'funnels', reports_to: 'funnels-mgr', channel: 'other',
    purpose: 'Runs A/B tests on headlines, offers and forms.',
    tasks: ['A/B test {niche} headline', 'Analyse form drop-off', 'Test demo vs audit offer'] },

  // ── Lead Generation ──
  { slug: 'leadgen-mgr', name: 'Harbor', title: 'Lead Generation Manager', tier: 'manager', department: 'leadgen', reports_to: 'cmo', channel: 'other',
    purpose: 'Decides which niches and cities to pull next and checks list quality.',
    tasks: ['Plan pulls: {niche} across 3 cities', 'QA today\'s lead batch'] },
  { slug: 'leadgen-maps', name: 'Scout', title: 'Google Maps Scraper', tier: 'specialist', department: 'leadgen', reports_to: 'leadgen-mgr', channel: 'other',
    purpose: 'Pulls businesses from Google Maps via Apify: name, phone, site, rating, reviews.',
    tasks: ['Pull {niche} businesses in {city}', 'Re-pull {city} for new {niche} listings', 'Pull {niche} in {city} suburbs'] },
  { slug: 'leadgen-enrich', name: 'Trace', title: 'Contact Enricher', tier: 'specialist', department: 'leadgen', reports_to: 'leadgen-mgr', channel: 'other',
    purpose: 'Finds owner names and emails from websites and listings.',
    tasks: ['Find owner emails: {niche} in {city}', 'Match owners to {niche} listings', 'Verify emails before outreach'] },
  { slug: 'leadgen-clean', name: 'Sieve', title: 'List Cleaner', tier: 'specialist', department: 'leadgen', reports_to: 'leadgen-mgr', channel: 'other',
    purpose: 'Removes duplicates, closed businesses and existing clients.',
    tasks: ['Dedupe {niche} list', 'Remove closed listings in {city}', 'Exclude current clients'] },

  // ── Research ──
  { slug: 'research-mgr', name: 'Lens', title: 'Research Manager', tier: 'manager', department: 'research', reports_to: 'cmo', channel: 'other',
    purpose: 'Owns lead scoring and the call-or-email decision per niche.',
    tasks: ['Review {niche} qualification rate', 'Calibrate willingness-to-pay scoring'] },
  { slug: 'research-qualifier', name: 'Sage', title: 'Lead Qualifier', tier: 'specialist', department: 'research', reports_to: 'research-mgr', channel: 'other',
    purpose: 'Scores willingness to pay from ads, reviews, team size and site.',
    tasks: ['Qualify {niche} leads from {city}', 'Check ad activity for {niche} batch', 'Read reviews for missed-call complaints'] },
  { slug: 'research-channel', name: 'Compass', title: 'Channel Analyst', tier: 'specialist', department: 'research', reports_to: 'research-mgr', channel: 'other',
    purpose: 'Decides call or email per lead and tracks which channel wins per niche.',
    tasks: ['Pick channels for {niche} batch', 'Compare call vs email results: {niche}', 'Update {niche} channel recommendation'] },
  { slug: 'research-callprep', name: 'Brief', title: 'Call Sheet Writer', tier: 'specialist', department: 'research', reports_to: 'research-mgr', channel: 'other',
    purpose: 'Writes talking points for every lead on the founder\'s call list.',
    tasks: ['Call sheets: {niche} in {city}', 'Opening lines for {niche} owners', 'Objection notes for {niche}'] },

  // ── Compliance ──
  { slug: 'compliance-mgr', name: 'Warden', title: 'Compliance Manager', tier: 'manager', department: 'compliance', reports_to: 'coo', channel: 'other',
    purpose: 'Keeps outreach within CAN-SPAM, TCPA and A2P rules so inboxes and numbers stay healthy.',
    tasks: ['Review blocked messages', 'Update suppression list'] },
  { slug: 'compliance-email', name: 'Shield', title: 'Email Compliance Checker', tier: 'specialist', department: 'compliance', reports_to: 'compliance-mgr', channel: 'other',
    purpose: 'Checks every email for opt-out, address, honest subject and spam triggers.',
    tasks: ['Check {niche} email batch', 'Scan subjects for spam triggers', 'Verify opt-out handling'] },
  { slug: 'compliance-phone', name: 'Gate', title: 'Call & SMS Rules Checker', tier: 'specialist', department: 'compliance', reports_to: 'compliance-mgr', channel: 'other',
    purpose: 'Checks call lists against do-not-call and SMS against A2P / TCPA rules.',
    tasks: ['DNC check: {niche} call list', 'Confirm calling hours for {city}', 'Review A2P registration status'] },

  // ── Outreach ──
  { slug: 'outreach-mgr', name: 'Signal', title: 'Outreach Manager', tier: 'manager', department: 'outreach', reports_to: 'cmo', channel: 'other',
    purpose: 'Runs sending volume, templates and follow-up cadence per niche.',
    tasks: ['Review {niche} reply rates', 'Plan tomorrow\'s send volume'] },
  { slug: 'outreach-writer', name: 'Quill', title: 'Email Writer', tier: 'specialist', department: 'outreach', reports_to: 'outreach-mgr', channel: 'email',
    purpose: 'Personalises the approved niche template for each lead.',
    tasks: ['Personalise {niche} emails for {city}', 'Draft first lines from research notes', 'Draft {niche} template v2 for approval'] },
  { slug: 'outreach-sender', name: 'Post', title: 'Sender & Deliverability', tier: 'specialist', department: 'outreach', reports_to: 'outreach-mgr', channel: 'email',
    purpose: 'Sends through Gmail within daily limits and watches bounce and spam rates.',
    tasks: ['Send scheduled {niche} emails', 'Check bounce rate this week', 'Warm up new inbox'] },
  { slug: 'outreach-followup', name: 'Tether', title: 'Follow-up Agent', tier: 'specialist', department: 'outreach', reports_to: 'outreach-mgr', channel: 'email',
    purpose: 'Sends day-3 and day-7 follow-ups to non-replies.',
    tasks: ['Day-3 follow-ups: {niche}', 'Day-7 breakup emails', 'Pause follow-ups for replied leads'] },

  // ── Sales ──
  { slug: 'sales-mgr', name: 'Anchor', title: 'Sales Manager', tier: 'manager', department: 'sales', reports_to: 'cmo', channel: 'other',
    purpose: 'Owns replies, demos and closing.',
    tasks: ['Pipeline review: {niche}', 'Coach demo script for {niche}'] },
  { slug: 'sales-replies', name: 'Answer', title: 'Reply Handler', tier: 'specialist', department: 'sales', reports_to: 'sales-mgr', channel: 'email',
    purpose: 'Reads replies, answers questions and pushes toward a booked call.',
    tasks: ['Answer {niche} replies', 'Sort replies: interested / not now / no', 'Send pricing to {city} prospect'] },
  { slug: 'sales-booker', name: 'Clasp', title: 'Demo Booker', tier: 'specialist', department: 'sales', reports_to: 'sales-mgr', channel: 'email',
    purpose: 'Books interested prospects onto the founder\'s calendar.',
    tasks: ['Book demos from {niche} replies', 'Confirm tomorrow\'s demos', 'Reschedule no-shows'] },
  { slug: 'sales-proposal', name: 'Pact', title: 'Proposal Writer', tier: 'specialist', department: 'sales', reports_to: 'sales-mgr', channel: 'email',
    purpose: 'Drafts proposals and pricing after demos.',
    tasks: ['Proposal: {niche} shop in {city}', 'Bundle quote: answering + text-back', 'Annual plan offer for {niche}'] },

  // ── Onboarding ──
  { slug: 'onboard-mgr', name: 'Keel', title: 'Onboarding Manager', tier: 'manager', department: 'onboarding', reports_to: 'coo', channel: 'other',
    purpose: 'Gets every new client live within a week.',
    tasks: ['Kickoff plan: new {niche} client', 'Review go-live checklist'] },
  { slug: 'onboard-setup', name: 'Rig', title: 'Account Setup', tier: 'specialist', department: 'onboarding', reports_to: 'onboard-mgr', channel: 'email',
    purpose: 'Creates the GHL sub-account, calendar and contacts for each client.',
    tasks: ['Set up GHL sub-account: {city} {niche} client', 'Connect client calendar', 'Import client contacts'] },
  { slug: 'onboard-script', name: 'Script', title: 'Call Script Builder', tier: 'specialist', department: 'onboarding', reports_to: 'onboard-mgr', channel: 'other',
    purpose: 'Writes each client\'s answering script from their intake form.',
    tasks: ['Build answering script: {niche} client', 'Add service area and pricing rules', 'Emergency routing for {niche} client'] },
  { slug: 'onboard-number', name: 'Port', title: 'Numbers & Forwarding', tier: 'specialist', department: 'onboarding', reports_to: 'onboard-mgr', channel: 'other',
    purpose: 'Ports or provisions numbers and sets up call forwarding.',
    tasks: ['Port number for {city} client', 'Set up forwarding + fallback', 'Register client for A2P texting'] },

  // ── Service Delivery ──
  { slug: 'delivery-mgr', name: 'Beam', title: 'Service Delivery Manager', tier: 'manager', department: 'delivery', reports_to: 'coo', channel: 'other',
    purpose: 'Keeps every client line answered and every missed call texted back.',
    tasks: ['Coverage check: overnight lines', 'Review answer rate by client'] },
  { slug: 'delivery-answer', name: 'Lumen', title: 'AI Receptionist', tier: 'specialist', department: 'delivery', reports_to: 'delivery-mgr', channel: 'voice',
    purpose: 'Answers client calls 24/7, captures the job and books it.',
    tasks: ['Live lines: {city} {niche} clients', 'Book service calls into client calendars', 'After-hours emergency line: {niche}'] },
  { slug: 'delivery-textback', name: 'Spark', title: 'Missed-Call Text-Back', tier: 'specialist', department: 'delivery', reports_to: 'delivery-mgr', channel: 'sms',
    purpose: 'Texts back every missed call within seconds and books the job.',
    tasks: ['Missed calls: {city} {niche} clients', 'Continue open text threads', 'Book jobs from text threads'] },
  { slug: 'delivery-qa', name: 'Tuner', title: 'Call QA Reviewer', tier: 'specialist', department: 'delivery', reports_to: 'delivery-mgr', channel: 'other',
    purpose: 'Scores calls and fixes scripts that miss bookings.',
    tasks: ['Score 25 calls from {niche} clients', 'Fix pricing objection answer', 'Flag calls that missed a booking'] },

  // ── Client Success ──
  { slug: 'success-mgr', name: 'Buoy', title: 'Client Success Manager', tier: 'manager', department: 'success', reports_to: 'coo', channel: 'other',
    purpose: 'Keeps clients getting value and renewing.',
    tasks: ['Weekly account health review', 'Plan save call for at-risk client'] },
  { slug: 'success-health', name: 'Pulse', title: 'Account Health Monitor', tier: 'specialist', department: 'success', reports_to: 'success-mgr', channel: 'other',
    purpose: 'Watches usage and flags accounts at risk.',
    tasks: ['Flag low-usage {niche} accounts', 'Spot churn signals this week', 'Check unanswered-call spikes'] },
  { slug: 'success-reports', name: 'Gauge', title: 'Results Reporter', tier: 'specialist', department: 'success', reports_to: 'success-mgr', channel: 'email',
    purpose: 'Sends each client a monthly "calls saved, jobs booked" report.',
    tasks: ['Monthly report: {city} {niche} client', 'Calls-saved summary for renewals', 'Quarterly review deck'] },
  { slug: 'success-reviews', name: 'Star', title: 'Review Booster', tier: 'specialist', department: 'success', reports_to: 'success-mgr', channel: 'sms',
    purpose: 'Gets clients more Google reviews from their happy customers.',
    tasks: ['Review requests: completed {niche} jobs', 'Follow up unreviewed jobs', 'Route unhappy replies to owner'] },

  // ── Finance ──
  { slug: 'finance-mgr', name: 'Abacus', title: 'Finance Manager', tier: 'manager', department: 'finance', reports_to: 'cfo', channel: 'other',
    purpose: 'Closes the books and reports the numbers that matter.',
    tasks: ['Weekly close', 'Founder snapshot: MRR, costs, margin'] },
  { slug: 'finance-billing', name: 'Stamp', title: 'Billing Agent', tier: 'specialist', department: 'finance', reports_to: 'finance-mgr', channel: 'email',
    purpose: 'Issues invoices and usage charges.',
    tasks: ['Invoice {niche} clients', 'Send annual renewals', 'Correct {city} client invoice'] },
  { slug: 'finance-collect', name: 'Mint', title: 'Collections Agent', tier: 'specialist', department: 'finance', reports_to: 'finance-mgr', channel: 'sms',
    purpose: 'Recovers failed cards and overdue balances.',
    tasks: ['Retry failed cards', 'Dunning texts: 30-day overdue', 'Payment plan offer'] },
  { slug: 'finance-analyst', name: 'Tally', title: 'Unit Economics Analyst', tier: 'specialist', department: 'finance', reports_to: 'finance-mgr', channel: 'other',
    purpose: 'Tracks cost per lead, per demo and per client by niche.',
    tasks: ['Cost per booked demo: {niche}', 'Apify + Claude spend this week', 'Margin per client: telephony costs'] },
];

/** Slugs from the first (octopus) org that the floor plan retires. */
export const RETIRED_SLUGS = [
  'lead-mgr', 'lead-scraper', 'lead-email', 'lead-caller', 'lead-qualifier', 'content-mgr', 'content-ads',
  'content-pages', 'content-social', 'sales-followup', 'answer-mgr', 'answer-reception', 'answer-dispatch',
  'answer-qa', 'text-mgr', 'text-responder', 'text-setter', 'text-reviews', 'success-setup', 'success-support',
  'billing-mgr', 'billing-invoice', 'billing-collect', 'finance-books', 'finance-spend',
];
export const RETIRED_DEPTS = ['lead-gen', 'content', 'answering', 'textback', 'billing'];

// ── Niches ─────────────────────────────────────────────────────────────────────

/** How a trade behaves, which drives the starting call-or-email lean. */
export const NICHE_PROFILE: Record<string, { emergency: boolean; highTicket: boolean; officeStaff: number }> = {
  plumbing:    { emergency: true,  highTicket: false, officeStaff: 0.35 },
  hvac:        { emergency: true,  highTicket: false, officeStaff: 0.45 },
  electrical:  { emergency: true,  highTicket: false, officeStaff: 0.35 },
  garage_door: { emergency: true,  highTicket: false, officeStaff: 0.25 },
  restoration: { emergency: true,  highTicket: true,  officeStaff: 0.55 },
  roofing:     { emergency: false, highTicket: true,  officeStaff: 0.6 },
  remodeling:  { emergency: false, highTicket: true,  officeStaff: 0.55 },
  pools:       { emergency: false, highTicket: true,  officeStaff: 0.6 },
  windows:     { emergency: false, highTicket: true,  officeStaff: 0.55 },
  landscaping: { emergency: false, highTicket: false, officeStaff: 0.4 },
};

const TEMPLATE_BODY = `Hi {first_name},

I was looking at {business} in {city} — strong reviews. Quick question: what happens when a customer calls while your team is on a job or after hours?

Most {niche_lower} companies we talk to lose 20–30% of calls that way. Octopus Engines answers every call 24/7 and texts back every missed call within seconds, so those jobs get booked instead of going to the next {niche_lower} company on Google.

Worth a 10-minute look? You can see how it works here: {landing_page}

— {sender_name}, Octopus Engines
{sender_address}

Not interested? Reply "stop" and I won't email again.`;

function niche(key: string, name: string, sort: number): Niche {
  return {
    key, name, active: true, channel_mode: 'auto', ghl_url: '', cities: '',
    template_subject: `Missed calls at {business}?`,
    template_body: TEMPLATE_BODY,
    template_approved: false, approved_at: null, sort_order: sort,
  };
}

export const DEFAULT_NICHES: Niche[] = [
  niche('plumbing', 'Plumbing', 0),
  niche('hvac', 'HVAC', 1),
  niche('electrical', 'Electrical', 2),
  niche('garage_door', 'Garage Door', 3),
  niche('restoration', 'Restoration', 4),
  niche('roofing', 'Roofing', 5),
  niche('remodeling', 'Remodeling (Kitchen & Bath)', 6),
  niche('pools', 'Pool Builders', 7),
  niche('windows', 'Windows & Doors', 8),
  niche('landscaping', 'Landscaping', 9),
];

export const TASKS_BY_SLUG: Record<string, string[]> = Object.fromEntries(
  DEFAULT_AGENTS.map(a => [a.slug, a.tasks]),
);

export function fillTemplate(t: string, rnd: () => number = Math.random) {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  return t
    .replace(/\{niche\}/g, () => pick(DEFAULT_NICHES).name)
    .replace(/\{city\}/g, () => pick(CITIES));
}

/** Preview rows for the default org, keyed by slug, used before the DB is staffed. */
export function previewAgents(): Agent[] {
  const created = '2026-01-01T00:00:00.000Z';
  return DEFAULT_AGENTS.map((a, i) => ({
    id: a.slug, slug: a.slug, name: a.name, title: a.title, tier: a.tier, department: a.department,
    reports_to: a.reports_to ?? null, purpose: a.purpose, channel: a.channel, status: 'active',
    model: '', system_prompt: '', activity: 'idle', current_task: '', last_active_at: null,
    sort_order: i, config: {}, created_at: created,
  }));
}

/** Upsert rows for the floor plan. Agents already in the DB keep their id (and
 *  whatever model / prompt you gave them); new ones get a fresh id. */
export function staffingRows(existing: Agent[], createdBy: string) {
  const bySlug = Object.fromEntries(existing.filter(a => a.slug).map(a => [a.slug!, a]));
  const ids = Object.fromEntries(DEFAULT_AGENTS.map(a => [a.slug, bySlug[a.slug]?.id ?? crypto.randomUUID()]));
  return DEFAULT_AGENTS.map((a, i) => {
    const prev = bySlug[a.slug];
    return {
      id: ids[a.slug],
      slug: a.slug,
      name: prev?.name ?? a.name,
      title: a.title,
      tier: a.tier,
      department: a.department,
      reports_to: a.reports_to ? ids[a.reports_to] : null,
      purpose: prev?.purpose || a.purpose,
      channel: a.channel,
      status: prev?.status && prev.status !== 'archived' ? prev.status : 'active',
      sort_order: i,
      // Every row carries the same columns: PostgREST nulls any a row leaves out.
      activity: prev?.activity ?? 'idle',
      created_by: createdBy,
    };
  });
}
