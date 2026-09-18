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
  /** Produced by the in-browser simulation, never stored. */
  sim?: boolean;
};

export type AgentEvent = {
  id: number | string;
  agent_id: string | null;
  to_agent_id: string | null;
  work_id: string | null;
  kind: EventKind;
  message: string;
  created_at: string;
  sim?: boolean;
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
