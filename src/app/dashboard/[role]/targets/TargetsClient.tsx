'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const DEFAULT_TARGET = 50;

type Agent = { id: string; name: string; role: string; department: string };
type SalesLog = { user_id: string; amount: number };
type Target = { id?: string; user_id: string; period: string; sales_count_target: number; revenue_target?: number };

const COMMISSION_TIERS = [
  { range: '1–10 sales', rate: '$10 / sale', min: 1, max: 10 },
  { range: '11–20 sales', rate: '$15 / sale', min: 11, max: 20 },
  { range: '21–30 sales', rate: '$20 / sale', min: 21, max: 30 },
  { range: '31–40 sales', rate: '$25 / sale', min: 31, max: 40 },
  { range: '41+ sales', rate: '$40 / sale', min: 41, max: Infinity },
];

function barColor(pct: number) {
  return pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--accent)' : 'var(--warn)';
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

  const getTarget = (userId: string) => targets.find(t => t.user_id === userId);
  const getCount = (userId: string) => salesLogs.filter(s => s.user_id === userId).length;
  const getRevenue = (userId: string) => salesLogs.filter(s => s.user_id === userId).reduce((s, l) => s + Number(l.amount), 0);

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
      const { data } = await dbOp('targets', 'insert', { user_id: agent.id, period, sales_count_target: newCount });
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
  const myCount = rows.find(r => r.agent.id === currentUserId)?.count ?? 0;

  return (
    <div className="page-fade">
      {/* Team summary stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">🎯</div></div>
          <div className="stat-l">TEAM COMPLETION</div>
          <div className="stat-v" style={{ color: barColor(teamPct) }}>{teamPct}%</div>
          <div className="stat-foot">{teamSales} / {teamTarget} sales</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">$</div></div>
          <div className="stat-l">TEAM REVENUE</div>
          <div className="stat-v">${teamRevenue.toLocaleString()}</div>
          <div className="stat-foot">{period}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico acc">↑</div></div>
          <div className="stat-l">TOP PERFORMER</div>
          <div className="stat-v" style={{ fontSize: 16 }}>
            {rows.sort((a, b) => b.pct - a.pct)[0]?.agent.name?.split(' ')[0] ?? '—'}
          </div>
          <div className="stat-foot">{rows[0]?.pct ?? 0}% completion</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">ON TARGET</div>
          <div className="stat-v">{rows.filter(r => r.pct >= 80).length}</div>
          <div className="stat-foot">≥ 80% complete</div>
        </div>
      </div>

      {/* Team progress bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Team Progress — {period}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{teamSales} / {teamTarget}</div>
          </div>
          <div style={{ height: 12, background: 'var(--surface-3)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${teamPct}%`, background: barColor(teamPct), borderRadius: 6, transition: 'width .6s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--ink-4)' }}>
            <span>0%</span>
            <span style={{ color: barColor(teamPct), fontWeight: 700 }}>{teamPct}%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Per-agent breakdown */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">{isMgmt ? 'Agent Breakdown' : 'My Progress'}</div>
            <div className="card-sub">{isMgmt ? 'Click target number to edit' : 'Your sales progress this month'}</div>
          </div>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          {rows.sort((a, b) => b.pct - a.pct).map(({ agent, targetCount, count, revenue, pct }) => {
            const hue = (agent.name.charCodeAt(0) * 13) % 360;
            return (
              <div key={agent.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--line-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="av-circle" style={{ width: 34, height: 34, fontSize: 11, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                      {agent.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{agent.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{agent.role} · {agent.department || '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9.5, color: 'var(--ink-4)', textTransform: 'uppercase', fontWeight: 600 }}>Revenue</div>
                      <div style={{ fontWeight: 600, color: 'var(--ok)', fontSize: 13 }}>${revenue.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9.5, color: 'var(--ink-4)', textTransform: 'uppercase', fontWeight: 600 }}>Sales / Target</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 700, color: barColor(pct), fontSize: 14 }}>{count}</span>
                        <span style={{ color: 'var(--ink-4)' }}>/</span>
                        {isMgmt && editingId === agent.id ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number" value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              style={{ width: 54, fontSize: 12, textAlign: 'center', border: '1px solid var(--accent)', borderRadius: 5, padding: '2px 4px' }}
                              min={1} autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') saveTarget(agent); if (e.key === 'Escape') setEditingId(null); }}
                            />
                            <button className="btn btn-acc btn-sm" style={{ padding: '3px 8px' }} disabled={saving} onClick={() => saveTarget(agent)}>✓</button>
                            <button className="btn btn-sec btn-sm" style={{ padding: '3px 8px' }} onClick={() => setEditingId(null)}>✕</button>
                          </span>
                        ) : (
                          <span
                            style={{ fontWeight: 600, color: 'var(--ink-3)', fontSize: 13, cursor: isMgmt ? 'pointer' : 'default', borderBottom: isMgmt ? '1px dashed var(--line)' : 'none' }}
                            onClick={() => isMgmt && startEdit(agent)}
                          >{targetCount}</span>
                        )}
                      </div>
                    </div>
                    <span className={`bdg ${pct >= 100 ? 'bdg-ok' : pct >= 50 ? 'bdg-acc' : 'bdg-warn'}`}>{pct}%</span>
                  </div>
                </div>
                <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: barColor(pct), borderRadius: 3, transition: 'width .5s' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Commission ladder */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">Commission Ladder</div>
        </div>
        <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {COMMISSION_TIERS.map(tier => {
            const active = myCount >= tier.min;
            const current = myCount >= tier.min && (tier.max === Infinity || myCount <= tier.max);
            return (
              <div key={tier.range} style={{
                padding: '14px 16px', borderRadius: 10,
                background: current ? 'oklch(0.96 0.05 145)' : active ? 'oklch(0.97 0.02 145)' : 'var(--surface-2)',
                border: `1.5px solid ${current ? 'oklch(0.85 0.08 145)' : active ? 'oklch(0.90 0.04 145)' : 'var(--line)'}`,
              }}>
                <div style={{ fontSize: 11, color: current ? 'var(--ok)' : 'var(--ink-3)', fontWeight: 700, marginBottom: 6 }}>{tier.range}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: current ? 'var(--ok)' : active ? 'oklch(0.48 0.10 145)' : 'var(--ink-3)' }}>{tier.rate}</div>
                {current && <div style={{ fontSize: 10, color: 'var(--ok)', marginTop: 6, fontWeight: 600 }}>● Current tier</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
