export type Tier = 'ceo' | 'exec' | 'manager' | 'specialist';
export type Activity = 'working' | 'idle' | 'reviewing' | 'revising' | 'blocked';
export type WorkStatus = 'queued' | 'in_progress' | 'in_review' | 'revision' | 'done' | 'cancelled';
export type EventKind =
  | 'request' | 'directive' | 'handoff' | 'progress' | 'review' | 'revision' | 'done' | 'alert';

export type Agent = {
  id: string;
  slug: string | null;
  name: string;
  title: string;
  tier: Tier;
  department: string;
  reports_to: string | null;
  purpose: string;
  channel: string;
  status: string;
  model: string;
  system_prompt: string;
  activity: Activity;
  current_task: string;
  last_active_at: string | null;
  sort_order: number;
  config: Record<string, unknown>;
  created_at: string;
};

export type Department = {
  key: string;
  name: string;
  blurb: string;
  arm_order: number;
  hue: number;
};

export type Work = {
  id: string;
  agent_id: string;
  parent_id: string | null;
  title: string;
  brief: string;
  output: string;
  status: WorkStatus;
  revision_count: number;
  revision_notes: string;
  requested_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentEvent = {
  id: number | string;
  agent_id: string | null;
  to_agent_id: string | null;
  work_id: string | null;
  kind: EventKind;
  message: string;
  created_at: string;
};

export type Run = {
  id: number;
  agent_id: string;
  status: string;
  outcome: string;
  contact_name: string;
  contact_info: string;
  duration_sec: number;
  transcript: string;
  error: string;
  created_at: string;
};

export const ACTIVITY_META: Record<Activity | 'offline', { label: string; color: string }> = {
  working:   { label: 'Working',   color: '#34d399' },
  reviewing: { label: 'Reviewing', color: '#fbbf24' },
  revising:  { label: 'Revising',  color: '#fb7185' },
  blocked:   { label: 'Blocked',   color: '#ef4444' },
  idle:      { label: 'Idle',      color: '#94a3b8' },
  offline:   { label: 'Paused',    color: '#475569' },
};

export const WORK_META: Record<WorkStatus, { label: string; badge: string }> = {
  queued:      { label: 'Queued',      badge: 'pv-bdg-gray' },
  in_progress: { label: 'In progress', badge: 'pv-bdg-indigo' },
  in_review:   { label: 'In review',   badge: 'pv-bdg-amber' },
  revision:    { label: 'Revision',    badge: 'pv-bdg-red' },
  done:        { label: 'Done',        badge: 'pv-bdg-green' },
  cancelled:   { label: 'Cancelled',   badge: 'pv-bdg-gray' },
};

export const EVENT_META: Record<EventKind, { icon: string; label: string }> = {
  request:   { icon: '✦', label: 'Request' },
  directive: { icon: '◆', label: 'Directive' },
  handoff:   { icon: '→', label: 'Handoff' },
  progress:  { icon: '•', label: 'Progress' },
  review:    { icon: '◎', label: 'Review' },
  revision:  { icon: '↺', label: 'Revision' },
  done:      { icon: '✓', label: 'Done' },
  alert:     { icon: '!', label: 'Alert' },
};

export const TIER_LABEL: Record<Tier, string> = {
  ceo: 'CEO', exec: 'Executive', manager: 'Manager', specialist: 'Specialist',
};

/** Paused or archived agents show as offline whatever their last activity was. */
export function effectiveActivity(a: Pick<Agent, 'status' | 'activity'>): Activity | 'offline' {
  if (a.status !== 'active') return 'offline';
  return a.activity ?? 'idle';
}

/** Rows from before v91 lack the hierarchy columns; give them safe defaults. */
export function normalizeAgent(raw: Record<string, unknown>): Agent {
  const r = raw as Partial<Agent>;
  return {
    id: String(r.id),
    slug: r.slug ?? null,
    name: r.name ?? 'Agent',
    title: r.title ?? '',
    tier: (r.tier as Tier) ?? 'specialist',
    department: r.department ?? '',
    reports_to: r.reports_to ?? null,
    purpose: r.purpose ?? '',
    channel: r.channel ?? 'other',
    status: r.status ?? 'draft',
    model: r.model ?? '',
    system_prompt: r.system_prompt ?? '',
    activity: (r.activity as Activity) ?? 'idle',
    current_task: r.current_task ?? '',
    last_active_at: r.last_active_at ?? null,
    sort_order: r.sort_order ?? 0,
    config: (r.config as Record<string, unknown>) ?? {},
    created_at: r.created_at ?? new Date().toISOString(),
  };
}

/** Short badge for a title: "Chief Marketing Officer" → "CMO". */
export function roleTag(a: Pick<Agent, 'title' | 'tier'>) {
  if (/^chief\b/i.test(a.title)) return a.title.split(/\s+/).map(w => w[0]).join('').toUpperCase();
  if (a.tier === 'ceo') return 'CEO';
  return a.title || TIER_LABEL[a.tier];
}

// ── Pipeline: niches, leads, outreach ──────────────────────────────────────────

export type Channel = 'call' | 'email';
export type ChannelMode = 'auto' | Channel;

export type Niche = {
  key: string;
  name: string;
  active: boolean;
  channel_mode: ChannelMode;
  ghl_url: string;
  cities: string;
  template_subject: string;
  template_body: string;
  template_approved: boolean;
  approved_at: string | null;
  sort_order: number;
};

/** What the researcher found out about a business. */
export type LeadSignals = {
  email_type?: 'owner' | 'generic' | 'none';
  has_website?: boolean;
  runs_ads?: boolean;
  hours_24_7?: boolean;
  staff_estimate?: number;
  office_staff?: boolean;
  missed_call_reviews?: boolean;
  place_id?: string;
  category?: string;
  /** Up to 10 Google review texts from the Maps pull. */
  reviews_sample?: string[];
  /** Where the ad signal came from, e.g. "Google Ads tag on site". */
  ads_evidence?: string;
  /** One-line summary from the research agent. */
  research_notes?: string;
  years_in_business?: number;
};

export type LeadStatus =
  | 'new' | 'researching' | 'qualified' | 'disqualified' | 'contacted' | 'replied' | 'booked' | 'not_interested';

export type Lead = {
  id: string;
  niche: string;
  business_name: string;
  owner_name: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  website: string;
  rating: number | null;
  review_count: number;
  source: string;
  signals: LeadSignals;
  status: LeadStatus;
  wtp_score: number | null;
  wtp_reasons: Reason[];
  contact_channel: Channel | null;
  channel_confidence: number | null;
  channel_reasons: Reason[];
  talking_points: string[];
  researched_by: string | null;
  researched_at: string | null;
  created_at: string;
  updated_at: string;
};

/** One scored reason: positive pushes toward (score up / this channel), negative away. */
export type Reason = { text: string; weight: number; toward?: Channel };

export type OutreachStatus =
  | 'draft' | 'compliance' | 'blocked' | 'scheduled' | 'sent' | 'replied' | 'bounced'
  | 'to_call' | 'no_answer' | 'callback' | 'interested' | 'booked' | 'not_interested';

export type Outreach = {
  id: string;
  lead_id: string;
  channel: Channel;
  status: OutreachStatus;
  subject: string;
  body: string;
  compliance_issues: string[];
  notes: string;
  agent_id: string | null;
  sent_at: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
};

export const LEAD_STATUS_META: Record<LeadStatus, { label: string; badge: string }> = {
  new:            { label: 'New',            badge: 'pv-bdg-gray' },
  researching:    { label: 'Researching',    badge: 'pv-bdg-indigo' },
  qualified:      { label: 'Qualified',      badge: 'pv-bdg-green' },
  disqualified:   { label: 'Disqualified',   badge: 'pv-bdg-gray' },
  contacted:      { label: 'Contacted',      badge: 'pv-bdg-indigo' },
  replied:        { label: 'Replied',        badge: 'pv-bdg-amber' },
  booked:         { label: 'Booked',         badge: 'pv-bdg-green' },
  not_interested: { label: 'Not interested', badge: 'pv-bdg-gray' },
};

export const OUTREACH_STATUS_META: Record<OutreachStatus, { label: string; badge: string }> = {
  draft:          { label: 'Draft',            badge: 'pv-bdg-gray' },
  compliance:     { label: 'Compliance check', badge: 'pv-bdg-indigo' },
  blocked:        { label: 'Blocked',          badge: 'pv-bdg-red' },
  scheduled:      { label: 'Scheduled',        badge: 'pv-bdg-amber' },
  sent:           { label: 'Sent',             badge: 'pv-bdg-indigo' },
  replied:        { label: 'Replied',          badge: 'pv-bdg-green' },
  bounced:        { label: 'Bounced',          badge: 'pv-bdg-red' },
  to_call:        { label: 'To call',          badge: 'pv-bdg-amber' },
  no_answer:      { label: 'No answer',        badge: 'pv-bdg-gray' },
  callback:       { label: 'Call back',        badge: 'pv-bdg-amber' },
  interested:     { label: 'Interested',       badge: 'pv-bdg-green' },
  booked:         { label: 'Booked',           badge: 'pv-bdg-green' },
  not_interested: { label: 'Not interested',   badge: 'pv-bdg-gray' },
};
