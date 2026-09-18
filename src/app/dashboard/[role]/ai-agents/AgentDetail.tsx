'use client';

import { useState } from 'react';
import {
  ACTIVITY_META, TIER_LABEL, WORK_META, roleTag,
  type Activity, type Agent, type AgentEvent, type Department, type Run, type Work,
} from '@/lib/aiAgents/types';
import { LIVE_AGENTS, NEXT_UP } from '@/lib/aiAgents/org';
import { FeedItem, timeAgo } from './LiveFeed';

type Props = {
  agent: Agent;
  byId: Record<string, Agent>;
  departments: Department[];
  activity: Activity | 'offline';
  task: string;
  work: Work[];
  events: AgentEvent[];
  runs: Run[];
  reports: Agent[];
  canManage: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  onDecide: (w: Work, decision: 'approve' | 'revise', notes?: string) => Promise<string | null>;
  onEdit: () => void;
  onSetStatus: (s: 'active' | 'paused' | 'archived') => void;
};

const ACTIVE: Work['status'][] = ['in_progress', 'in_review', 'revision'];

export function WorkCard({ w, onDecide, showAgent }: { w: Work; onDecide: Props['onDecide']; showAgent?: string }) {
  const [revising, setRevising] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (decision: 'approve' | 'revise') => {
    setBusy(true);
    setErr('');
    const e = await onDecide(w, decision, notes.trim());
    setBusy(false);
    if (e) { setErr(e); return; }
    setRevising(false);
    setNotes('');
  };

  return (
    <div className={`ag-work ag-work-${w.status}`}>
      <div className="ag-work-h">
        <span className="ag-work-t">{w.title}</span>
        <span className={`pv-bdg ${WORK_META[w.status].badge}`}>{WORK_META[w.status].label.toUpperCase()}</span>
      </div>
      <div className="ag-work-meta" suppressHydrationWarning>
        {showAgent ? `${showAgent} · ` : ''}Updated {timeAgo(w.updated_at)}
        {w.revision_count > 0 && <span className="ag-rev-pill">↺ {w.revision_count} revision{w.revision_count === 1 ? '' : 's'}</span>}
      </div>
      {w.brief && <div className="ag-work-brief">{w.brief}</div>}
      {w.status === 'revision' && w.revision_notes && (
        <div className="ag-work-notes"><b>Revision notes</b>{w.revision_notes}</div>
      )}
      {w.output && <div className="ag-work-out">{w.output}</div>}
      {w.status === 'in_review' && !revising && (
        <div className="ag-work-actions">
          <button type="button" className="btn btn-sm btn-acc" disabled={busy} onClick={() => run('approve')}>Approve</button>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setRevising(true)}>Request revision</button>
        </div>
      )}
      {revising && (
        <div className="ag-work-rev">
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What needs to change?" autoFocus />
          <div className="ag-work-actions">
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setRevising(false)}>Cancel</button>
            <button type="button" className="btn btn-sm btn-acc" disabled={busy || !notes.trim()} onClick={() => run('revise')}>Send back</button>
          </div>
        </div>
      )}
      {err && <div className="ag-err">{err}</div>}
    </div>
  );
}

export default function AgentDetail({
  agent, byId, departments, activity, task, work, events, runs, reports,
  canManage, onSelect, onClose, onDecide, onEdit, onSetStatus,
}: Props) {
  const dept = departments.find(d => d.key === agent.department);
  const liveDuty = agent.slug ? LIVE_AGENTS[agent.slug] : undefined;
  const boss = agent.reports_to ? byId[agent.reports_to] : undefined;
  const active = work.filter(w => ACTIVE.includes(w.status)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const queued = work.filter(w => w.status === 'queued');
  const done = work.filter(w => w.status === 'done').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')).slice(0, 5);
  const meta = ACTIVITY_META[activity];

  return (
    <div className="ag-panel">
      <div className="ag-panel-h ag-detail-h">
        <button type="button" className="ag-link" onClick={onClose}>✕ Close</button>
        <div className="ag-id">
          <div className="ag-avatar" style={{ borderColor: meta.color, boxShadow: `0 0 0 4px ${meta.color}22` }}>
            {agent.name.slice(0, 1)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="ag-id-name">{agent.name}</div>
            <div className="ag-id-title">{agent.title || TIER_LABEL[agent.tier]}</div>
            <div className="ag-id-tags">
              <span className="ag-tag">{agent.tier === 'exec' || agent.tier === 'ceo' ? roleTag(agent) : TIER_LABEL[agent.tier]}</span>
              {dept && <span className="ag-tag" style={{ borderColor: `hsl(${dept.hue} 70% 60%)` }}>{dept.name}</span>}
              <span className="ag-tag">{agent.channel}</span>
            </div>
          </div>
        </div>
        <div className="ag-now" style={{ borderColor: meta.color }}>
          <span className="ag-now-lbl"><i style={{ background: meta.color }} />{meta.label}</span>
          <span className="ag-now-task">{task || (activity === 'offline' ? 'Paused — not taking work' : 'Waiting for the next assignment')}</span>
        </div>
      </div>

      <div className="ag-panel-body">
        {liveDuty
          ? <div className="ag-live-note"><b>● Live</b>{liveDuty}</div>
          : <div className="ag-live-note planned"><b>Planned</b>{NEXT_UP[agent.slug ?? ''] ?? 'Not live yet. This agent is on the floor plan and will be built in a later step.'}</div>}
        {agent.purpose && <p className="ag-purpose">{agent.purpose}</p>}

        {(boss || reports.length > 0) && (
          <div className="ag-sec">
            {boss && (
              <div className="ag-chain">
                <span>Reports to</span>
                <button type="button" className="ag-chip-btn" onClick={() => onSelect(boss.id)}>{boss.name} · {boss.tier === 'manager' ? boss.title : roleTag(boss)}</button>
              </div>
            )}
            {reports.length > 0 && (
              <div className="ag-chain">
                <span>Team ({reports.length})</span>
                <div className="ag-chips">
                  {reports.map(r => (
                    <button key={r.id} type="button" className="ag-chip-btn" onClick={() => onSelect(r.id)}>{r.name}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="ag-sec">
          <div className="ag-sec-t">Currently producing {active.length > 0 && <span className="ag-count">{active.length}</span>}</div>
          {active.length === 0 ? (
            <div className="ag-empty">Nothing in flight.</div>
          ) : (
            active.map(w => <WorkCard key={w.id} w={w} onDecide={onDecide} />)
          )}
        </div>

        {queued.length > 0 && (
          <div className="ag-sec">
            <div className="ag-sec-t">Up next <span className="ag-count">{queued.length}</span></div>
            {queued.map(w => (
              <div key={w.id} className="ag-queued">
                <span>{w.title}</span>
                <span className="ag-feed-meta" suppressHydrationWarning>{timeAgo(w.created_at)}</span>
              </div>
            ))}
          </div>
        )}

        {done.length > 0 && (
          <div className="ag-sec">
            <div className="ag-sec-t">Recently shipped</div>
            {done.map(w => (
              <div key={w.id} className="ag-queued">
                <span>✓ {w.title}{w.revision_count > 0 ? ` · ${w.revision_count} rev` : ''}</span>
                <span className="ag-feed-meta" suppressHydrationWarning>{w.completed_at ? timeAgo(w.completed_at) : ''}</span>
              </div>
            ))}
          </div>
        )}

        {runs.length > 0 && (
          <div className="ag-sec">
            <div className="ag-sec-t">Calls &amp; conversations</div>
            {runs.slice(0, 6).map(r => (
              <div key={r.id} className="ag-queued">
                <span>{r.contact_name || 'Unknown contact'}{r.outcome ? ` — ${r.outcome}` : ''}</span>
                <span className="ag-feed-meta">{r.status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        )}

        <div className="ag-sec">
          <div className="ag-sec-t">Activity</div>
          {events.length === 0 ? <div className="ag-empty">No activity yet.</div> : events.map(e => <FeedItem key={e.id} e={e} byId={byId} />)}
        </div>

        {canManage && (
          <div className="ag-sec ag-manage">
            <button type="button" className="btn btn-sm" onClick={onEdit}>Configure</button>
            <button type="button" className="btn btn-sm" onClick={() => onSetStatus(agent.status === 'active' ? 'paused' : 'active')}>
              {agent.status === 'active' ? 'Pause' : 'Activate'}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onSetStatus('archived')}>Archive</button>
          </div>
        )}
      </div>
    </div>
  );
}
