'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const TRIGGERS = [
  'Late clock-in (per 5 min)',
  'Full day absence (no-show)',
  'Low productivity (< 6h tracked)',
  'Points threshold reached',
  'Overtime worked (> 8h)',
  'Missed schedule submission',
  'Custom trigger',
];

const ACTIONS = [
  'Deduct points',
  'Deduct salary',
  'Flag for termination review',
  'Auto-notify supervisor',
  'Award bonus',
  'Custom action',
];

export default function PolicyClient({ initialPolicies }: { initialPolicies: any[] }) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleRunNow = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/cron/policies', {
        method: 'POST',
        headers: { authorization: 'Bearer dev-secret' },
      });
      const json = await res.json();
      if (json.success) {
        setRunResult(`✓ Policies evaluated for ${json.date}: ${json.violations_created} violation${json.violations_created !== 1 ? 's' : ''} created, ${json.employees_affected} employee${json.employees_affected !== 1 ? 's' : ''} affected, ${json.inbox_notices_sent} inbox notice${json.inbox_notices_sent !== 1 ? 's' : ''} sent.`);
        // Refresh executed counts
        const updated = policies.map((p: any) => ({
          ...p,
          executed: (p.executed ?? 0) + (json.violations_created > 0 ? 1 : 0),
        }));
        setPolicies(updated);
      } else {
        setRunResult(`✗ Error: ${json.error ?? 'Unknown error'}`);
      }
    } catch (e: any) {
      setRunResult(`✗ Network error: ${e.message}`);
    }
    setRunning(false);
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    const { error } = await dbOp('policies', 'update', { active: !currentActive }, { id });
    if (!error) setPolicies(policies.map(p => p.id === id ? { ...p, active: !currentActive } : p));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    const { error } = await dbOp('policies', 'delete', undefined, { id });
    if (!error) setPolicies(policies.filter(p => p.id !== id));
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const newPolicy = {
      name: fd.get('name') as string,
      trigger: fd.get('trigger') as string,
      trigger_detail: fd.get('trigger_detail') as string,
      action: fd.get('action') as string,
      action_detail: fd.get('action_detail') as string,
      active: true,
      executed: 0,
    };
    const { data, error: err } = await dbOp('policies', 'insert', newPolicy);
    if (err) {
      setError(err);
    } else if (data && data[0]) {
      setPolicies([...policies, data[0]]);
      setIsAdding(false);
      (e.target as HTMLFormElement).reset();
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="pn-h" style={{ marginBottom: '20px' }}>
        <div>
          <div className="pn-t">Policy Engine</div>
          <div style={{ fontSize: '12px', color: '#6b7689', marginTop: '2px' }}>
            Rules are evaluated nightly by the automated cron job
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="pv-btn pv-btn-sec" onClick={handleRunNow} disabled={running} style={{ fontSize: '12px' }}>
            {running ? '⏳ Running…' : '▶ Run Policies Now'}
          </button>
          <button className="pv-btn pv-btn-pri" onClick={() => setIsAdding(true)}>+ New Rule</button>
        </div>
      </div>

      {runResult && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '16px',
          background: runResult.startsWith('✓') ? '#ecfdf5' : '#fef2f2',
          color: runResult.startsWith('✓') ? '#047857' : '#dc2626',
          border: `1px solid ${runResult.startsWith('✓') ? '#6ee7b7' : '#fecaca'}`,
        }}>
          {runResult}
        </div>
      )}

      <div className="pn" style={{ marginBottom: '20px' }}>
        {policies.length === 0 && <div className="empty">No rules configured yet.</div>}
        {policies.map(p => (
          <div key={p.id} className="r-cd" style={{ flexDirection: 'column', alignItems: 'stretch', opacity: p.active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a1f2e' }}>{p.name}</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span className="pv-bdg pv-bdg-indigo">{p.executed ?? 0}× fired</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={p.active}
                    onChange={() => handleToggle(p.id, p.active)}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  {p.active ? 'Active' : 'Paused'}
                </label>
                <button
                  onClick={() => handleDelete(p.id)}
                  style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}
                  title="Delete rule"
                >✕</button>
              </div>
            </div>
            <div style={{ fontSize: '12.5px', color: '#4a5568', background: '#f5f6f8', padding: '10px 12px', borderRadius: '6px', display: 'flex', gap: '24px' }}>
              <div><strong>Trigger →</strong> {p.trigger}{p.trigger_detail ? ` (${p.trigger_detail})` : ''}</div>
              <div><strong>Action →</strong> {p.action}{p.action_detail ? ` (${p.action_detail})` : ''}</div>
            </div>
          </div>
        ))}
      </div>

      {isAdding && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '28px', borderRadius: '14px', width: '500px', maxWidth: '95%' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '18px' }}>Create New Policy Rule</div>
            <form onSubmit={handleCreate}>
              <div className="pv-fld">
                <label>Rule Name</label>
                <input type="text" name="name" required placeholder="e.g. Late Clock-In Penalty" />
              </div>
              <div className="pv-fld">
                <label>Trigger</label>
                <select name="trigger" required>
                  {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Trigger Detail <span style={{ color: '#6b7689', fontWeight: 400 }}>(optional — e.g. "every 5 minutes")</span></label>
                <input type="text" name="trigger_detail" placeholder="Additional trigger condition" />
              </div>
              <div className="pv-fld">
                <label>Action</label>
                <select name="action" required>
                  {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Action Detail <span style={{ color: '#6b7689', fontWeight: 400 }}>(optional — e.g. "-0.5 points, -$10")</span></label>
                <input type="text" name="action_detail" placeholder="Specific penalty or reward amount" />
              </div>
              {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={saving}>{saving ? 'Saving...' : 'Create Rule'}</button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => { setIsAdding(false); setError(''); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
