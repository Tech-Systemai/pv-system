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

const TRIGGER_ICONS: Record<string, string> = {
  'Late clock-in (per 5 min)': '⏰',
  'Full day absence (no-show)': '🚫',
  'Low productivity (< 6h tracked)': '📉',
  'Points threshold reached': '⚠',
  'Overtime worked (> 8h)': '⏱',
  'Missed schedule submission': '📅',
  'Custom trigger': '⚙',
};

export default function PolicyClient({ initialPolicies }: { initialPolicies: any[] }) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  const active = policies.filter(p => p.active);
  const paused = policies.filter(p => !p.active);
  const totalFired = policies.reduce((s, p) => s + (p.executed ?? 0), 0);

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
        setPolicies(policies.map((p: any) => ({
          ...p,
          executed: (p.executed ?? 0) + (json.violations_created > 0 ? 1 : 0),
        })));
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
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">ACTIVE RULES</div>
          <div className="stat-v">{active.length}</div>
          <div className="stat-foot">Running nightly</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico gy">⏸</div></div>
          <div className="stat-l">PAUSED</div>
          <div className="stat-v" style={{ color: 'var(--ink-3)' }}>{paused.length}</div>
          <div className="stat-foot">Disabled rules</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">⚡</div></div>
          <div className="stat-l">TOTAL FIRED</div>
          <div className="stat-v">{totalFired}</div>
          <div className="stat-foot">All-time executions</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">⚙</div></div>
          <div className="stat-l">TOTAL RULES</div>
          <div className="stat-v">{policies.length}</div>
          <div className="stat-foot">Configured policies</div>
        </div>
      </div>

      {/* Briefing card */}
      <div className="briefing" style={{ marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>⚡ Policy Engine</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            Rules evaluate nightly and automatically apply deductions, flags, and inbox notices. Run manually to test.
          </div>
          {runResult && (
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 7, fontSize: 12,
              background: runResult.startsWith('✓') ? 'oklch(0.96 0.04 145)' : 'oklch(0.97 0.03 25)',
              color: runResult.startsWith('✓') ? 'var(--ok)' : 'var(--err)',
              border: `1px solid ${runResult.startsWith('✓') ? 'oklch(0.88 0.07 145)' : 'oklch(0.90 0.06 25)'}`,
            }}>
              {runResult}
            </div>
          )}
        </div>
        <div className="briefing-actions">
          <button className="btn btn-sec btn-sm" onClick={handleRunNow} disabled={running}>
            {running ? '⏳ Running…' : '▶ Run Now'}
          </button>
          <button className="btn btn-acc btn-sm" onClick={() => setIsAdding(true)}>+ New Rule</button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Policy Rules</div>
            <div className="card-sub">{active.length} active · Evaluated nightly by cron</div>
          </div>
        </div>

        {policies.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No rules configured yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Trigger</th>
                  <th>Action</th>
                  <th>Fired</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {policies.map(p => (
                  <tr key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{TRIGGER_ICONS[p.trigger] ?? '⚙'}</span>
                        <div>
                          <div style={{ fontSize: 12 }}>{p.trigger}</div>
                          {p.trigger_detail && <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>{p.trigger_detail}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{p.action}</div>
                      {p.action_detail && <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>{p.action_detail}</div>}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{p.executed ?? 0}×</td>
                    <td>
                      <button
                        onClick={() => handleToggle(p.id, p.active)}
                        className={`bdg ${p.active ? 'bdg-ok' : 'bdg-gy'}`}
                        style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit', fontSize: 11 }}
                      >
                        {p.active ? '● Active' : '○ Paused'}
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(p.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--err)', cursor: 'pointer', fontSize: 16, padding: '2px 6px', lineHeight: 1 }}
                        title="Delete rule"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Rule modal */}
      {isAdding && (
        <div className="mb">
          <div className="md" style={{ width: 500 }}>
            <div className="md-t">Create Policy Rule</div>
            <form onSubmit={handleCreate}>
              <div className="pv-fld"><label>Rule Name</label><input type="text" name="name" required placeholder="e.g. Late Clock-In Penalty" /></div>
              <div className="pv-fld">
                <label>Trigger</label>
                <select name="trigger" required>
                  {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Trigger Detail <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional)</span></label>
                <input type="text" name="trigger_detail" placeholder="Additional condition detail" />
              </div>
              <div className="pv-fld">
                <label>Action</label>
                <select name="action" required>
                  {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Action Detail <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional)</span></label>
                <input type="text" name="action_detail" placeholder="e.g. -0.5 points, -$10" />
              </div>
              {error && (
                <div style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={saving}>{saving ? 'Saving…' : 'Create Rule'}</button>
                <button type="button" className="btn btn-sec" onClick={() => { setIsAdding(false); setError(''); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
