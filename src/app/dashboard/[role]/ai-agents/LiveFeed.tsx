'use client';

import { useState } from 'react';
import { EVENT_META, type Agent, type AgentEvent, type EventKind } from '@/lib/aiAgents/types';

const FILTERS: { key: string; label: string; kinds: EventKind[] | null }[] = [
  { key: 'all',       label: 'All',       kinds: null },
  { key: 'revisions', label: 'Revisions', kinds: ['revision'] },
  { key: 'review',    label: 'Reviews',   kinds: ['review', 'done'] },
  { key: 'requests',  label: 'Requests',  kinds: ['request', 'directive'] },
  { key: 'alerts',    label: 'Alerts',    kinds: ['alert'] },
];

export function timeAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function FeedItem({ e, byId, onSelect }: { e: AgentEvent; byId: Record<string, Agent>; onSelect?: (id: string) => void }) {
  const a = e.agent_id ? byId[e.agent_id] : undefined;
  return (
    <button
      type="button"
      className={`ag-feed-item ag-ev-${e.kind}`}
      onClick={() => a && onSelect?.(a.id)}
      disabled={!a || !onSelect}
    >
      <span className="ag-feed-ico">{EVENT_META[e.kind].icon}</span>
      <span className="ag-feed-main">
        <span className="ag-feed-msg">{e.message}</span>
        <span className="ag-feed-meta" suppressHydrationWarning>
          {EVENT_META[e.kind].label}
          {a ? ` · ${a.name}` : ''} · {timeAgo(e.created_at)}
          {e.sim && <span className="ag-sample">sample</span>}
        </span>
      </span>
    </button>
  );
}

export default function LiveFeed({ events, byId, onSelect }: {
  events: AgentEvent[];
  byId: Record<string, Agent>;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState('all');
  const kinds = FILTERS.find(f => f.key === filter)?.kinds;
  const shown = kinds ? events.filter(e => kinds.includes(e.kind)) : events;
  const revisions = events.filter(e => e.kind === 'revision').length;

  return (
    <div className="ag-panel">
      <div className="ag-panel-h">
        <div className="ag-panel-t"><span className="pulse" /> Live feed</div>
        <div className="ag-panel-sub">Everything the team is doing, as it happens. Select an agent to see their work.</div>
        <div className="ag-filters">
          {FILTERS.map(f => (
            <button key={f.key} type="button" className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
              {f.label}
              {f.key === 'revisions' && revisions > 0 && <span className="ag-rev-pill">{revisions}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="ag-panel-body">
        {shown.length === 0 ? (
          <div className="ag-empty">
            {filter === 'all' ? 'Quiet so far. Activity lands here the moment an agent picks up, hands off or ships work.' : 'Nothing here yet.'}
          </div>
        ) : (
          shown.map(e => <FeedItem key={e.id} e={e} byId={byId} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}
