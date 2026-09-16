'use client';

import { useMemo, useState } from 'react';
import { dbOp } from '@/utils/db';

type Agent = {
  id: string;
  name: string;
  purpose: string;
  channel: string;
  status: string;
  model: string;
  system_prompt: string;
  config: Record<string, any>;
  created_at: string;
};

type Run = {
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

const CHANNELS = [
  { value: 'voice', label: 'Voice' },
  { value: 'sms',   label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'chat',  label: 'Web Chat' },
  { value: 'other', label: 'Other' },
];

const STATUSES = [
  { value: 'draft',    label: 'Draft' },
  { value: 'active',   label: 'Active' },
  { value: 'paused',   label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

const CHANNEL_ICON: Record<string, string> = {
  voice: '📞', sms: '💬', email: '✉', chat: '🗨', other: '⚙',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'pv-bdg-green', paused: 'pv-bdg-amber', draft: 'pv-bdg-gray', archived: 'pv-bdg-gray',
};

const RUN_BADGE: Record<string, string> = {
  completed: 'pv-bdg-green', running: 'pv-bdg-indigo', failed: 'pv-bdg-red', no_answer: 'pv-bdg-amber',
};

function fmtDuration(sec: number) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function AiAgentsClient({
  initialAgents,
  initialRuns,
  canManage,
  currentUserId,
}: {
  initialAgents: Agent[];
  initialRuns: Run[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [runs] = useState<Run[]>(initialRuns);
  const [tab, setTab] = useState<'registry' | 'runs'>('registry');
  const [editing, setEditing] = useState<Partial<Agent> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [viewingRun, setViewingRun] = useState<Run | null>(null);
  const [runFilter, setRunFilter] = useState<string>('all');

  const agentName = useMemo(
    () => Object.fromEntries(agents.map(a => [a.id, a.name])),
    [agents],
  );

  const stats = useMemo(() => {
    const active = agents.filter(a => a.status === 'active').length;
    const today = new Date().toDateString();
    const todayRuns = runs.filter(r => new Date(r.created_at).toDateString() === today);
    const completed = runs.filter(r => r.status === 'completed').length;
    const connectRate = runs.length > 0 ? Math.round((completed / runs.length) * 100) : 0;
    return { active, total: agents.length, todayRuns: todayRuns.length, connectRate };
  }, [agents, runs]);

  const visibleRuns = useMemo(
    () => (runFilter === 'all' ? runs : runs.filter(r => r.agent_id === runFilter)),
    [runs, runFilter],
  );

  const openNew = () => {
    setErr('');
    setIsNew(true);
    setEditing({ name: '', purpose: '', channel: 'voice', status: 'draft', model: '', system_prompt: '' });
  };

  const openEdit = (a: Agent) => {
    setErr('');
    setIsNew(false);
    setEditing(a);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    const fd = new FormData(e.currentTarget);
    const payload = {
      name:          (fd.get('name') as string).trim(),
      purpose:       (fd.get('purpose') as string).trim(),
      channel:       fd.get('channel') as string,
      status:        fd.get('status') as string,
      model:         (fd.get('model') as string).trim(),
      system_prompt: (fd.get('system_prompt') as string).trim(),
    };

    if (isNew) {
      const { data, error } = await dbOp('ai_agents', 'insert', {
        ...payload,
        created_by: currentUserId,
      });
      if (error) { setErr(error); setSaving(false); return; }
      if (data?.[0]) setAgents(prev => [data[0] as Agent, ...prev]);
    } else {
      const { data, error } = await dbOp(
        'ai_agents',
        'update',
        { ...payload, updated_at: new Date().toISOString() },
        { id: editing?.id },
      );
      if (error) { setErr(error); setSaving(false); return; }
      if (data?.[0]) setAgents(prev => prev.map(a => (a.id === editing?.id ? (data[0] as Agent) : a)));
    }

    setSaving(false);
    setEditing(null);
  };

  const toggleStatus = async (a: Agent) => {
    const next = a.status === 'active' ? 'paused' : 'active';
    setAgents(prev => prev.map(x => (x.id === a.id ? { ...x, status: next } : x)));
    const { error } = await dbOp(
      'ai_agents',
      'update',
      { status: next, updated_at: new Date().toISOString() },
      { id: a.id },
    );
    // Roll back the optimistic flip if the write did not land.
    if (error) setAgents(prev => prev.map(x => (x.id === a.id ? { ...x, status: a.status } : x)));
  };

  const archiveAgent = async (a: Agent) => {
    const { error } = await dbOp(
      'ai_agents',
      'update',
      { status: 'archived', updated_at: new Date().toISOString() },
      { id: a.id },
    );
    if (!error) setAgents(prev => prev.filter(x => x.id !== a.id));
  };

  return (
    <div className="page-fade">
      {/* ── Stat cards ── */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico">🤖</div></div>
          <div className="stat-l">ACTIVE AGENTS</div>
          <div className="stat-v">{stats.active}</div>
          <div className="stat-foot">{stats.total} configured in total</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico">▶</div></div>
          <div className="stat-l">RUNS TODAY</div>
          <div className="stat-v">{stats.todayRuns}</div>
          <div className="stat-foot">Conversations started today</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">COMPLETION RATE</div>
          <div className="stat-v">{stats.connectRate}%</div>
          <div className="stat-foot">Across the last {runs.length} runs</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico">📋</div></div>
          <div className="stat-l">LOGGED RUNS</div>
          <div className="stat-v">{runs.length}</div>
          <div className="stat-foot">Most recent 200 shown</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="tabs">
          <button className={`tab${tab === 'registry' ? ' active' : ''}`} onClick={() => setTab('registry')}>
            Agent Registry
          </button>
          <button className={`tab${tab === 'runs' ? ' active' : ''}`} onClick={() => setTab('runs')}>
            Run Log
          </button>
        </div>
        {tab === 'registry' && canManage && (
          <button className="btn btn-acc btn-sm" onClick={openNew}>+ New Agent</button>
        )}
      </div>

      {/* ── Registry ── */}
      {tab === 'registry' && (
        agents.length === 0 ? (
          <div className="card">
            <div className="empty">
              No agents yet.{canManage ? ' Create your first outreach agent to get started.' : ''}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {agents.map(a => {
              const agentRuns = runs.filter(r => r.agent_id === a.id);
              return (
                <div key={a.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                      <div style={{ fontSize: 20 }}>{CHANNEL_ICON[a.channel] ?? '⚙'}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'capitalize' }}>
                          {a.channel}{a.model ? ` · ${a.model}` : ''}
                        </div>
                      </div>
                    </div>
                    <span className={`pv-bdg ${STATUS_BADGE[a.status] ?? 'pv-bdg-gray'}`}>
                      {a.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6, minHeight: 38 }}>
                    {a.purpose || <span style={{ color: 'var(--ink-4)' }}>No purpose described yet.</span>}
                  </div>

                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--ink-3)', borderTop: '1px solid var(--line-2)', paddingTop: 9 }}>
                    <span>{agentRuns.length} runs</span>
                    <span>Created {fmtDate(a.created_at)}</span>
                  </div>

                  {canManage && (
                    <div style={{ display: 'flex', gap: 7 }}>
                      <button className="btn btn-sm" onClick={() => openEdit(a)}>Configure</button>
                      <button className="btn btn-sm" onClick={() => toggleStatus(a)}>
                        {a.status === 'active' ? 'Pause' : 'Activate'}
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => archiveAgent(a)}>Archive</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Run log ── */}
      {tab === 'runs' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="card-title">Recent runs</div>
            <select
              className="fld-input"
              value={runFilter}
              onChange={e => setRunFilter(e.target.value)}
            >
              <option value="all">All agents</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {visibleRuns.length === 0 ? (
            <div className="empty">No runs logged yet.</div>
          ) : (
            <div className="scrollable">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Agent</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Outcome</th>
                    <th>Duration</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRuns.map(r => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-3)' }}>{fmtDate(r.created_at)}</td>
                      <td style={{ fontWeight: 600 }}>{agentName[r.agent_id] ?? 'Unknown agent'}</td>
                      <td>
                        {r.contact_name || '—'}
                        {r.contact_info && (
                          <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.contact_info}</div>
                        )}
                      </td>
                      <td>
                        <span className={`pv-bdg ${RUN_BADGE[r.status] ?? 'pv-bdg-gray'}`}>
                          {r.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ color: 'var(--ink-2)' }}>{r.outcome || '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDuration(r.duration_sec)}</td>
                      <td>
                        {(r.transcript || r.error) && (
                          <button className="btn btn-sm btn-ghost" onClick={() => setViewingRun(r)}>View</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Agent editor modal ── */}
      {editing && (
        <div className="mb" onClick={() => !saving && setEditing(null)}>
          <div className="md" onClick={e => e.stopPropagation()}>
            <div className="md-t">{isNew ? 'New AI Agent' : `Configure · ${editing.name}`}</div>
            <form onSubmit={handleSave}>
              <div className="pv-fld">
                <label>Name</label>
                <input type="text" name="name" defaultValue={editing.name} required placeholder="e.g. Outbound Lead Qualifier" />
              </div>
              <div className="pv-fld">
                <label>Purpose</label>
                <textarea name="purpose" rows={2} defaultValue={editing.purpose} placeholder="What this agent is responsible for" />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="pv-fld" style={{ flex: 1 }}>
                  <label>Channel</label>
                  <select name="channel" defaultValue={editing.channel}>
                    {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="pv-fld" style={{ flex: 1 }}>
                  <label>Status</label>
                  <select name="status" defaultValue={editing.status}>
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="pv-fld">
                <label>Model</label>
                <input type="text" name="model" defaultValue={editing.model} placeholder="e.g. claude-sonnet-5" />
              </div>
              <div className="pv-fld">
                <label>System prompt</label>
                <textarea
                  name="system_prompt"
                  rows={9}
                  defaultValue={editing.system_prompt}
                  placeholder="You are an outreach agent for Octopus Engines, calling HVAC contractors to book a demo…"
                />
              </div>

              {err && <div style={{ color: 'var(--err)', fontSize: 12, marginBottom: 10 }}>{err}</div>}

              <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-acc" disabled={saving}>
                  {saving ? <><span className="spin" />Saving…</> : isNew ? 'Create agent' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Run detail modal ── */}
      {viewingRun && (
        <div className="mb" onClick={() => setViewingRun(null)}>
          <div className="md" onClick={e => e.stopPropagation()}>
            <div className="md-t">
              {agentName[viewingRun.agent_id] ?? 'Run'} · {fmtDate(viewingRun.created_at)}
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>
              <span>{viewingRun.contact_name || 'No contact'}</span>
              <span>{fmtDuration(viewingRun.duration_sec)}</span>
              <span className={`pv-bdg ${RUN_BADGE[viewingRun.status] ?? 'pv-bdg-gray'}`}>
                {viewingRun.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            {viewingRun.error && (
              <div style={{ background: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                {viewingRun.error}
              </div>
            )}
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.7 }}>
              {viewingRun.transcript || 'No transcript recorded.'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={() => setViewingRun(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
