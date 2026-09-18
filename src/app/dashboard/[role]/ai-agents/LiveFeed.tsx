'use client';

import { EVENT_META, type Agent, type AgentEvent } from '@/lib/aiAgents/types';

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
