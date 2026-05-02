'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const DEFAULT_TARGET = 50;

type Agent = { id: string; name: string; role: string; department: string };
type SalesLog = { user_id: string; amount: number };
type Target = { id?: string; user_id: string; period: string; sales_count_target: number; revenue_target?: number };

function bar(pct: number) {
  return pct >= 80 ? '#10b981' : pct >= 50 ? '#4f46e5' : '#f59e0b';
}

export default function TargetsClient({
  agents,
  salesLogs,
  targets: initialTargets,
  period,
  isMgmt,
  currentUserId,
}: {
  agents: Agent[];
  salesLogs: SalesLog[];
  targets: Target[];
  period: string;
  isMgmt: boolean;
  currentUserId: string;
}) {
  const [targets, setTargets] = useState<Target[]>(initialTargets);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const getTarget = (userId: string): Target | undefined =>
    targets.find(t => t.user_id === userId);

  const getCount = (userId: string) =>
    salesLogs.filter(s => s.user_id === userId).length;

  const getRevenue = (userId: string) =>
    salesLogs.filter(s => s.user_id === userId).reduce((s, l) => s + Number(l.amount), 0);

  const startEdit = (agent: Agent) => {
    const t = getTarget(agent.id);
    setEditValue(String(t?.sales_count_target ?? DEFAULT_TARGET));
    setEditingId(agent.id);
  };

  const saveTarget = async (agent: Agent) => {
    const newCount = Math.max(1, parseInt(editValue) || DEFAULT_TARGET);
    setSaving(true);
    const existing = getTarget(agent.id);

    if (existing?.id) {
      await dbOp('targets', 'update', { sales_count_target: newCount }, { id: existing.id });
      setTargets(targets.map(t => t.id === existing.id ? { ...t, sales_count_target: newCount } : t));
    } else {
      const { data } = await dbOp('targets', 'insert', {
        user_id: agent.id,
        period,
        sales_count_target: newCount,
      });
      if (data?.[0]) setTargets([...targets, data[0]]);
    }
    setEditingId(null);
    setSaving(false);
  };

  const rows = agents.map(a => {
    const t = getTarget(a.id);
    const targetCount = t?.sales_count_target ?? DEFAULT_TARGET;
    const count = getCount(a.id);
    const revenue = getRevenue(a.id);
    const pct = Math.min(Math.round((count / targetCount) * 100), 100);
    return { agent: a, targetCount, count, revenue, pct };
  });

  const teamSales = rows.reduce((s, r) => s + r.count, 0);
  const teamTarget = rows.reduce((s, r) => s + r.targetCount, 0);
  const teamPct = teamTarget > 0 ? Math.min(Math.round((teamSales / teamTarget) * 100), 100) : 0;
  const teamRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  return (
    <div>
      <div className="pn-h" style={{ marginBottom: '20px' }}>
        <div>
          <div className="pn-t">Monthly Targets · {period}</div>
          <div style={{ fontSize: '12px', color: '#6b7689', marginTop: '2px' }}>
            {isMgmt ? 'Click the target number to edit per-person' : 'Your sales progress this month'}
          </div>
        </div>
      </div>

      {/* Team summary */}
      <div className="pn" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 700 }}>Total Sales</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#1a1f2e' }}>{teamSales}<span style={{ fontSize: '13px', color: '#6b7689', fontWeight: 500 }}> / {teamTarget}</span></div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 700 }}>Team Revenue</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#047857' }}>${teamRevenue.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 700 }}>Completion</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: bar(teamPct) }}>{teamPct}%</div>
          </div>
        </div>
        <div className="bw" style={{ height: '8px' }}>
          <div className="bf" style={{ width: `${teamPct}%`, background: bar(teamPct) }} />
        </div>
      </div>

      {/* Per-agent rows */}
      <div className="pn" style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1f2e', marginBottom: '14px' }}>
          {isMgmt ? 'Agent Breakdown' : 'My Progress'}
        </div>
        {rows.length === 0 && <div className="empty">No agents found.</div>}
        {rows.sort((a, b) => b.pct - a.pct).map(({ agent, targetCount, count, revenue, pct }) => (
          <div key={agent.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0f2f5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="av gy" style={{ width: '32px', height: '32px', fontSize: '11px' }}>
                  {agent.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{agent.name}</div>
                  <div style={{ fontSize: '11px', color: '#6b7689' }}>{agent.role} · {agent.department || '—'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '9.5px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 600 }}>Revenue</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#047857' }}>${revenue.toLocaleString()}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '9.5px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 600 }}>Sales / Target</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: bar(pct) }}>{count}</span>
                    <span style={{ fontSize: '12px', color: '#6b7689' }}>/</span>
                    {isMgmt && editingId === agent.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          style={{ width: '54px', fontSize: '12px', textAlign: 'center' }}
                          min={1}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveTarget(agent);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button
                          className="pv-btn pv-btn-pri"
                          style={{ fontSize: '10px', padding: '3px 8px' }}
                          disabled={saving}
                          onClick={() => saveTarget(agent)}
                        >
                          {saving ? '...' : '✓'}
                        </button>
                        <button
                          className="pv-btn pv-btn-sec"
                          style={{ fontSize: '10px', padding: '3px 8px' }}
                          onClick={() => setEditingId(null)}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span
                        style={{ fontSize: '13px', fontWeight: 600, color: '#4a5568', cursor: isMgmt ? 'pointer' : 'default', borderBottom: isMgmt ? '1px dashed #9ca3af' : 'none' }}
                        onClick={() => isMgmt && startEdit(agent)}
                        title={isMgmt ? 'Click to edit target' : undefined}
                      >
                        {targetCount}
                      </span>
                    )}
                  </div>
                </div>

                <span className={`pv-bdg ${pct >= 100 ? 'pv-bdg-green' : pct >= 50 ? 'pv-bdg-indigo' : 'pv-bdg-amber'}`}>
                  {pct}%
                </span>
              </div>
            </div>
            <div className="bw" style={{ height: '5px' }}>
              <div className="bf" style={{ width: `${pct}%`, background: bar(pct) }} />
            </div>
          </div>
        ))}
      </div>

      {/* Commission ladder */}
      <div className="pn">
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1f2e', marginBottom: '14px' }}>Commission Ladder</div>
        {[
          { range: '1–10 sales', rate: '$10 / sale', min: 1, max: 10 },
          { range: '11–20 sales', rate: '$15 / sale', min: 11, max: 20 },
          { range: '21–30 sales', rate: '$20 / sale', min: 21, max: 30 },
          { range: '31–40 sales', rate: '$25 / sale', min: 31, max: 40 },
          { range: '41+ sales', rate: '$40 / sale', min: 41, max: Infinity },
        ].map(tier => {
          const myCount = rows.find(r => r.agent.id === currentUserId)?.count ?? 0;
          const active = myCount >= tier.min;
          return (
            <div key={tier.range} style={{
              display: 'flex', justifyContent: 'space-between', padding: '11px 12px',
              borderBottom: '1px solid #f0f2f5',
              background: active ? '#ecfdf5' : '#fff',
              color: active ? '#047857' : '#4a5568',
              fontWeight: active ? 600 : 400,
              borderRadius: active ? '6px' : '0',
              marginBottom: active ? '2px' : '0',
            }}>
              <span>{tier.range}</span>
              <span style={{ fontWeight: 600 }}>{tier.rate}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
