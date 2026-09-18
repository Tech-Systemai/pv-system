'use client';

import { useState } from 'react';
import type { Activity, Agent, AgentEvent, Department, Work } from '@/lib/aiAgents/types';
import { WorkCard } from './AgentDetail';
import { timeAgo } from './LiveFeed';

type Lane = 'progress' | 'revision' | 'alerts' | 'approved';

const LANES: { key: Lane; label: string; hint: string }[] = [
  { key: 'progress', label: 'In progress',    hint: 'Being worked on, or waiting for your approval' },
  { key: 'revision', label: 'Needs revision', hint: 'Sent back and being redone' },
  { key: 'alerts',   label: 'Alerts',         hint: 'Blocked or needs your attention' },
  { key: 'approved', label: 'Approved',       hint: 'Signed off in the last 7 days' },
];

type Item =
  | { type: 'work'; w: Work; at: string }
  | { type: 'event'; e: AgentEvent; at: string }
  | { type: 'blocked'; a: Agent; task: string; at: string };

const WEEK = 7 * 86_400_000;
const DAY2 = 2 * 86_400_000;

export default function UpdatesView({
  departments, agents, work, events, activityOf, taskOf, onDecide, onOpenAgent,
}: {
  departments: Department[];
  agents: Agent[];
  work: Work[];
  events: AgentEvent[];
  activityOf: (id: string) => Activity | 'offline';
  taskOf: (id: string) => string;
  onDecide: (w: Work, decision: 'approve' | 'revise', notes?: string) => Promise<string | null>;
  onOpenAgent: (id: string) => void;
}) {
  const [lane, setLane] = useState<Lane | 'all'>('all');
  const [dept, setDept] = useState('all');
  const [openDept, setOpenDept] = useState<Record<string, boolean>>({});
  const [now] = useState(() => Date.now());

  const byId = Object.fromEntries(agents.map(a => [a.id, a]));
  const deptOf = (agentId: string | null) => (agentId ? byId[agentId]?.department : undefined) ?? '';

  // Sort every item into its department and lane.
  const buckets: Record<string, Record<Lane, Item[]>> = {};
  const put = (d: string, l: Lane, item: Item) => {
    buckets[d] ??= { progress: [], revision: [], alerts: [], approved: [] };
    buckets[d][l].push(item);
  };
  for (const w of work) {
    const d = deptOf(w.agent_id);
    if (w.status === 'revision') put(d, 'revision', { type: 'work', w, at: w.updated_at });
    else if (['queued', 'in_progress', 'in_review'].includes(w.status)) put(d, 'progress', { type: 'work', w, at: w.updated_at });
    else if (w.status === 'done' && now - new Date(w.completed_at ?? w.updated_at).getTime() < WEEK) {
      put(d, 'approved', { type: 'work', w, at: w.completed_at ?? w.updated_at });
    }
  }
  for (const e of events) {
    if (e.kind === 'alert' && now - new Date(e.created_at).getTime() < DAY2) put(deptOf(e.agent_id), 'alerts', { type: 'event', e, at: e.created_at });
  }
  for (const a of agents) {
    if (activityOf(a.id) === 'blocked') put(a.department, 'alerts', { type: 'blocked', a, task: taskOf(a.id), at: new Date(now).toISOString() });
  }
  for (const d of Object.values(buckets)) {
    for (const l of Object.keys(d) as Lane[]) {
      // Awaiting-approval work first, then newest.
      d[l].sort((x, y) => {
        const ax = x.type === 'work' && x.w.status === 'in_review' ? 1 : 0;
        const ay = y.type === 'work' && y.w.status === 'in_review' ? 1 : 0;
        return ay - ax || y.at.localeCompare(x.at);
      });
    }
  }

  const totals = { progress: 0, revision: 0, alerts: 0, approved: 0 };
  for (const d of Object.values(buckets)) for (const l of Object.keys(totals) as Lane[]) totals[l] += d[l].length;
  const awaiting = work.filter(w => w.status === 'in_review').length;

  const floors = [...departments].sort((a, b) => a.arm_order - b.arm_order);
  const shownDepts = floors.filter(f => dept === 'all' || f.key === dept);
  const lanes = LANES.filter(l => lane === 'all' || l.key === lane);

  const renderItem = (item: Item) => {
    if (item.type === 'work') {
      return <WorkCard key={item.w.id} w={item.w} onDecide={onDecide} showAgent={byId[item.w.agent_id]?.name} />;
    }
    if (item.type === 'event') {
      const a = item.e.agent_id ? byId[item.e.agent_id] : undefined;
      return (
        <button key={item.e.id} type="button" className="up-alert" onClick={() => a && onOpenAgent(a.id)}>
          <b>! {a?.name ?? 'Agent'}</b>
          <span>{item.e.message}</span>
          <small suppressHydrationWarning>{timeAgo(item.e.created_at)}</small>
        </button>
      );
    }
    return (
      <button key={`blk-${item.a.id}`} type="button" className="up-alert" onClick={() => onOpenAgent(item.a.id)}>
        <b>⛔ {item.a.name} is blocked</b>
        <span>{item.task || 'Waiting on something'}</span>
      </button>
    );
  };

  return (
    <div className="up-wrap">
      <div className="up-top">
        <div className="up-pills">
          <button type="button" className={lane === 'all' ? 'on' : ''} onClick={() => setLane('all')}>All lanes</button>
          {LANES.map(l => (
            <button key={l.key} type="button" className={`up-pill-${l.key}${lane === l.key ? ' on' : ''}`} onClick={() => setLane(l.key)} title={l.hint}>
              {l.label} <b>{totals[l.key]}</b>
            </button>
          ))}
        </div>
        <select className="fld-input" value={dept} onChange={e => setDept(e.target.value)}>
          <option value="all">All departments</option>
          {floors.map(f => <option key={f.key} value={f.key}>{f.name}</option>)}
        </select>
      </div>
      {awaiting > 0 && <div className="up-await">⏳ {awaiting} item{awaiting === 1 ? '' : 's'} waiting for your approval — they&apos;re at the top of In progress.</div>}

      {shownDepts.map(f => {
        const b = buckets[f.key] ?? { progress: [], revision: [], alerts: [], approved: [] };
        const count = lanes.reduce((t, l) => t + b[l.key].length, 0);
        const open = openDept[f.key] ?? count > 0;
        return (
          <section key={f.key} className="up-dept" style={{ ['--hue' as string]: f.hue }}>
            <button type="button" className="up-dept-h" onClick={() => setOpenDept(o => ({ ...o, [f.key]: !open }))}>
              <i />
              <b>{f.name}</b>
              <span className="up-counts">
                {LANES.map(l => b[l.key].length > 0 && (
                  <span key={l.key} className={`up-c up-c-${l.key}`}>{b[l.key].length} {l.label.toLowerCase()}</span>
                ))}
                {LANES.every(l => b[l.key].length === 0) && <span className="up-c">Nothing to report</span>}
              </span>
              <span className={`ag-caret${open ? ' open' : ''}`}>›</span>
            </button>
            {open && (
              <div className="up-lanes" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}>
                {lanes.map(l => (
                  <div key={l.key} className={`up-lane up-lane-${l.key}`}>
                    <div className="up-lane-h">{l.label} <span>{b[l.key].length}</span></div>
                    {b[l.key].length === 0 ? <div className="up-none">—</div> : b[l.key].slice(0, 6).map(renderItem)}
                    {b[l.key].length > 6 && <div className="up-more">+{b[l.key].length - 6} more</div>}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
