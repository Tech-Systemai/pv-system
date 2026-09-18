'use client';

import { useState } from 'react';
import { TIER_LABEL, type Agent, type Department, type Tier } from '@/lib/aiAgents/types';

export type AgentDraft = {
  id?: string;
  name: string;
  title: string;
  tier: Tier;
  department: string;
  reports_to: string;
  purpose: string;
  channel: string;
  status: string;
  model: string;
  system_prompt: string;
};

const CHANNELS = [
  { value: 'voice', label: 'Voice' },
  { value: 'sms',   label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'chat',  label: 'Web Chat' },
  { value: 'other', label: 'Other' },
];

// Who each tier normally reports to, for filtering the "Reports to" list.
const BOSS_TIER: Record<Tier, Tier[]> = {
  ceo: [], exec: ['ceo'], manager: ['exec', 'ceo'], specialist: ['manager', 'exec'],
};

export default function AgentEditor({ draft, agents, departments, onCancel, onSave }: {
  draft: AgentDraft;
  agents: Agent[];
  departments: Department[];
  onCancel: () => void;
  onSave: (d: AgentDraft) => Promise<string | null>;
}) {
  const [d, setD] = useState<AgentDraft>(draft);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof AgentDraft>(k: K, v: AgentDraft[K]) => setD(prev => ({ ...prev, [k]: v }));

  const bosses = agents.filter(a => a.id !== d.id && BOSS_TIER[d.tier].includes(a.tier)
    && (a.tier !== 'manager' || !d.department || a.department === d.department));
  const needsDept = d.tier === 'manager' || d.tier === 'specialist';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    const res = await onSave({ ...d, department: needsDept ? d.department : '' });
    if (res) { setErr(res); setSaving(false); }
  };

  return (
    <div className="mb" onClick={() => !saving && onCancel()}>
      <div className="md" onClick={e => e.stopPropagation()}>
        <div className="md-t">{d.id ? `Configure · ${draft.name}` : 'Hire an agent'}</div>
        <form onSubmit={submit}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="pv-fld" style={{ flex: 1 }}>
              <label>Name</label>
              <input type="text" value={d.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Scout" />
            </div>
            <div className="pv-fld" style={{ flex: 1.4 }}>
              <label>Title</label>
              <input type="text" value={d.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Prospect Researcher" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="pv-fld" style={{ flex: 1 }}>
              <label>Level</label>
              <select value={d.tier} onChange={e => set('tier', e.target.value as Tier)}>
                {(Object.keys(TIER_LABEL) as Tier[]).map(t => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
              </select>
            </div>
            {needsDept && (
              <div className="pv-fld" style={{ flex: 1.4 }}>
                <label>Department (arm)</label>
                <select value={d.department} onChange={e => set('department', e.target.value)}>
                  <option value="">Unassigned</option>
                  {departments.map(x => <option key={x.key} value={x.key}>{x.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {d.tier !== 'ceo' && (
            <div className="pv-fld">
              <label>Reports to</label>
              <select value={d.reports_to} onChange={e => set('reports_to', e.target.value)}>
                <option value="">Nobody</option>
                {bosses.map(b => <option key={b.id} value={b.id}>{b.name} · {b.title || TIER_LABEL[b.tier]}</option>)}
              </select>
            </div>
          )}
          <div className="pv-fld">
            <label>Purpose</label>
            <textarea rows={2} value={d.purpose} onChange={e => set('purpose', e.target.value)} placeholder="What this agent is responsible for" />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="pv-fld" style={{ flex: 1 }}>
              <label>Channel</label>
              <select value={d.channel} onChange={e => set('channel', e.target.value)}>
                {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="pv-fld" style={{ flex: 1 }}>
              <label>Status</label>
              <select value={d.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="pv-fld" style={{ flex: 1.2 }}>
              <label>Model</label>
              <input type="text" value={d.model} onChange={e => set('model', e.target.value)} placeholder="e.g. claude-sonnet-5" />
            </div>
          </div>
          <div className="pv-fld">
            <label>System prompt</label>
            <textarea rows={7} value={d.system_prompt} onChange={e => set('system_prompt', e.target.value)}
              placeholder="You are the Prospect Researcher for Octopus Engines. You build lists of home-service contractors…" />
          </div>

          {err && <div style={{ color: 'var(--err)', fontSize: 12, marginBottom: 10 }}>{err}</div>}

          <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-acc" disabled={saving}>
              {saving ? <><span className="spin" />Saving…</> : d.id ? 'Save changes' : 'Hire agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
