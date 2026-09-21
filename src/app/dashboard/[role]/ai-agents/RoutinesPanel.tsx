'use client';

import { useState } from 'react';
import type { Routine } from '@/lib/aiAgents/types';
import { timeAgo } from './LiveFeed';

// Work on the office's own clock: what runs, when, and what happened last time.

const ACTIONS: { key: Routine['action']; label: string }[] = [
  { key: 'find_leads', label: 'Find more leads' },
  { key: 'research', label: 'Research the new leads' },
  { key: 'write_emails', label: 'Write emails' },
  { key: 'send_emails', label: 'Send what I approved' },
];

const clock = (h: number, m: number) => `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;

export default function RoutinesPanel({ routines, canEdit, onSave, onRun, onDelete }: {
  routines: Routine[];
  canEdit: boolean;
  onSave: (r: Partial<Routine>) => Promise<string | null>;
  onRun: (id: string) => Promise<string>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Partial<Routine> | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const save = async (r: Partial<Routine>) => {
    setBusy(String(r.id ?? 'new'));
    const e = await onSave(r);
    setBusy('');
    setMsg(e ?? '');
    if (!e) setDraft(null);
  };

  return (
    <div className="rt-panel">
      <div className="rt-head">
        <b>Routines</b>
        <span className="tb-sub">Work the office starts by itself. Times are Eastern; each runs once a day.</span>
        {canEdit && (
          <button type="button" className="btn btn-sm" onClick={() => setDraft({ name: '', action: 'find_leads', days: 'weekdays', at_hour: 8, at_minute: 0, active: true, params: { max: 40 } })}>
            + New routine
          </button>
        )}
      </div>

      {routines.map(r => (
        <div key={r.id} className={`rt-row${r.active ? ' on' : ''}`}>
          <label className="nc-toggle">
            <input type="checkbox" checked={r.active} disabled={!canEdit || !!busy} onChange={e => save({ ...r, active: e.target.checked })} />
          </label>
          <span className="rt-name">
            <b>{r.name}</b>
            <small>{ACTIONS.find(a => a.key === r.action)?.label} · {r.days === 'daily' ? 'every day' : 'weekdays'} at {clock(r.at_hour, r.at_minute)}</small>
            {r.last_run_at && <small className="rt-last" suppressHydrationWarning>Last run {timeAgo(r.last_run_at)}: {r.last_result}</small>}
          </span>
          {canEdit && (
            <span className="rt-actions">
              <button type="button" className="btn btn-sm" disabled={!!busy} onClick={async () => { setBusy(r.id); setMsg(await onRun(r.id)); setBusy(''); }}>
                {busy === r.id ? <><span className="spin" />Running…</> : 'Run now'}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setDraft(r)}>Edit</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => onDelete(r.id)}>Remove</button>
            </span>
          )}
        </div>
      ))}
      {routines.length === 0 && <div className="ag-empty">No routines yet. Add one and the office starts it on time, every time.</div>}
      {msg && <div className="tb-sub">{msg}</div>}

      {draft && (
        <div className="rt-edit">
          <label>Name<input value={draft.name ?? ''} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Top up the lead list" /></label>
          <label>Does what
            <select value={draft.action} onChange={e => setDraft({ ...draft, action: e.target.value as Routine['action'] })}>
              {ACTIONS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </label>
          <label>Days
            <select value={draft.days} onChange={e => setDraft({ ...draft, days: e.target.value })}>
              <option value="weekdays">Weekdays</option>
              <option value="daily">Every day</option>
            </select>
          </label>
          <label>At
            <select value={draft.at_hour} onChange={e => setDraft({ ...draft, at_hour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{clock(h, 0)}</option>)}
            </select>
          </label>
          <div className="ag-work-actions">
            <button type="button" className="btn btn-sm" onClick={() => setDraft(null)}>Cancel</button>
            <button type="button" className="btn btn-sm btn-acc" disabled={!!busy} onClick={() => save(draft)}>Save routine</button>
          </div>
        </div>
      )}
    </div>
  );
}
