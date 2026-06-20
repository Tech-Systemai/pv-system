'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

type Agent = { id: string; name: string; role: string; department: string };
type SalesLog = { user_id: string; amount: number };
type Target = { id?: string; user_id: string; period: string; sales_count_target: number; collection_amount_target?: number };
type CxBonus = { amount: number; threshold: number };

// Down-payment commission: agents earn a per-$600-collected rate that steps up by tier.
const COLLECT_UNIT = 600;
const COMMISSION_TIERS = [
  { label: 'Tier 1', range: 'First $6,000', rate: '$10 / $600', minUnits: 0, maxUnits: 10, perUnit: 10 },
  { label: 'Tier 2', range: '$6,000 – $12,000', rate: '$15 / $600', minUnits: 10, maxUnits: 20, perUnit: 15 },
  { label: 'Tier 3', range: '$12,000 and above', rate: '$20 / $600', minUnits: 20, maxUnits: Infinity, perUnit: 20 },
];

// Total commission earned for a collected down-payment amount, applying each tier's
// per-$600 rate to the units that fall inside that tier (tier 3 continues at $20).
function salesCommission(collected: number) {
  let units = Math.floor(collected / COLLECT_UNIT);
  let total = 0;
  for (const tier of COMMISSION_TIERS) {
    if (units <= 0) break;
    const span = tier.maxUnits === Infinity ? units : tier.maxUnits - tier.minUnits;
    const inTier = Math.min(units, span);
    total += inTier * tier.perUnit;
    units -= inTier;
  }
  return total;
}

function barColor(pct: number) {
  return pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--accent)' : 'var(--warn)';
}

function AgentRow({
  agent, collected, commission, targetAmt, pct, isMgmt, editingId, editValue, saving,
  setEditValue, onStartEdit, onSave, onCancel,
}: {
  agent: Agent; collected: number; commission: number; targetAmt: number; pct: number;
  isMgmt: boolean; editingId: string | null; editValue: string; saving: boolean;
  setEditValue: (v: string) => void;
  onStartEdit: () => void; onSave: () => void; onCancel: () => void;
}) {
  const hue = (agent.name.charCodeAt(0) * 13) % 360;
  const hasTarget = targetAmt > 0;
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--line-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasTarget ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="av-circle" style={{ width: 34, height: 34, fontSize: 11, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
            {agent.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{agent.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {agent.role} · Commission: <span style={{ color: 'var(--ok)', fontWeight: 700 }}>${commission.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9.5, color: 'var(--ink-4)', textTransform: 'uppercase', fontWeight: 600 }}>Collected / Target</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontWeight: 700, color: barColor(pct), fontSize: 14 }}>${collected.toLocaleString()}</span>
              <span style={{ color: 'var(--ink-4)' }}>/</span>
              {isMgmt && editingId === agent.id ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number" value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    style={{ width: 80, fontSize: 12, textAlign: 'center', border: '1px solid var(--accent)', borderRadius: 5, padding: '2px 4px' }}
                    min={0} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
                  />
                  <button className="btn btn-acc btn-sm" style={{ padding: '3px 8px' }} disabled={saving} onClick={onSave}>✓</button>
                  <button className="btn btn-sec btn-sm" style={{ padding: '3px 8px' }} onClick={onCancel}>✕</button>
                </span>
              ) : (
                <span
                  style={{ fontWeight: 600, color: 'var(--ink-3)', fontSize: 13, cursor: isMgmt ? 'pointer' : 'default', borderBottom: isMgmt ? '1px dashed var(--line)' : 'none' }}
                  onClick={() => isMgmt && onStartEdit()}
                >${targetAmt.toLocaleString()}</span>
              )}
            </div>
          </div>
          {hasTarget && (
            <span className={`bdg ${pct >= 100 ? 'bdg-ok' : pct >= 50 ? 'bdg-acc' : 'bdg-warn'}`}>{pct}%</span>
          )}
        </div>
      </div>
      {hasTarget && (
        <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor(pct), borderRadius: 3, transition: 'width .5s' }} />
        </div>
      )}
    </div>
  );
}

function CxRow({
  agent, collected, targetAmt, cxBonus, isMgmt, editingId, editValue, saving,
  setEditValue, onStartEdit, onSave, onCancel,
}: {
  agent: Agent; collected: number; targetAmt: number; cxBonus: CxBonus;
  isMgmt: boolean; editingId: string | null; editValue: string; saving: boolean;
  setEditValue: (v: string) => void;
  onStartEdit: () => void; onSave: () => void; onCancel: () => void;
}) {
  const pct = targetAmt > 0 ? Math.min(Math.round((collected / targetAmt) * 100), 100) : 0;
  const bonus = Math.floor(collected / cxBonus.threshold) * cxBonus.amount;
  const hue = (agent.name.charCodeAt(0) * 13) % 360;
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--line-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: targetAmt > 0 ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="av-circle" style={{ width: 34, height: 34, fontSize: 11, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
            {agent.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{agent.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              CX · Bonus: <span style={{ color: 'var(--ok)', fontWeight: 700 }}>${bonus}</span>
              <span style={{ color: 'var(--ink-4)' }}> ({Math.floor(collected / cxBonus.threshold)} × ${cxBonus.amount})</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9.5, color: 'var(--ink-4)', textTransform: 'uppercase', fontWeight: 600 }}>Collected / Target</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontWeight: 700, color: barColor(pct), fontSize: 14 }}>${collected.toLocaleString()}</span>
              <span style={{ color: 'var(--ink-4)' }}>/</span>
              {isMgmt && editingId === agent.id ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number" value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    style={{ width: 80, fontSize: 12, textAlign: 'center', border: '1px solid var(--accent)', borderRadius: 5, padding: '2px 4px' }}
                    min={0} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
                  />
                  <button className="btn btn-acc btn-sm" style={{ padding: '3px 8px' }} disabled={saving} onClick={onSave}>✓</button>
                  <button className="btn btn-sec btn-sm" style={{ padding: '3px 8px' }} onClick={onCancel}>✕</button>
                </span>
              ) : (
                <span
                  style={{ fontWeight: 600, color: 'var(--ink-3)', fontSize: 13, cursor: isMgmt ? 'pointer' : 'default', borderBottom: isMgmt ? '1px dashed var(--line)' : 'none' }}
                  onClick={() => isMgmt && onStartEdit()}
                >${targetAmt.toLocaleString()}</span>
              )}
            </div>
          </div>
          {targetAmt > 0 && (
            <span className={`bdg ${pct >= 100 ? 'bdg-ok' : pct >= 50 ? 'bdg-acc' : 'bdg-warn'}`}>{pct}%</span>
          )}
        </div>
      </div>
      {targetAmt > 0 && (
        <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor(pct), borderRadius: 3, transition: 'width .5s' }} />
        </div>
      )}
    </div>
  );
}

export default function TargetsClient({
  agents,
  salesLogs,
  collectionLogs,
  targets: initialTargets,
  period,
  isMgmt,
  currentUserId,
  currentUserRole,
  cxBonus,
}: {
  agents: Agent[];
  salesLogs: SalesLog[];
  collectionLogs: SalesLog[];
  targets: Target[];
  period: string;
  isMgmt: boolean;
  currentUserId: string;
  currentUserRole: string;
  cxBonus: CxBonus;
}) {
  const [targets, setTargets] = useState<Target[]>(initialTargets);
  const [activeTab, setActiveTab] = useState<'sales' | 'cx'>('sales');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const getTarget = (userId: string) => targets.find(t => t.user_id === userId);
  const getSalesRevenue = (userId: string) => salesLogs.filter(s => s.user_id === userId).reduce((s, l) => s + Number(l.amount), 0);
  const getCollected = (userId: string) => collectionLogs.filter(c => c.user_id === userId).reduce((s, c) => s + Number(c.amount), 0);

  const startSalesEdit = (agent: Agent) => {
    const t = getTarget(agent.id);
    setEditValue(String(t?.collection_amount_target ?? 0));
    setEditingId(agent.id);
  };

  const startCxEdit = (agent: Agent) => {
    const t = getTarget(agent.id);
    setEditValue(String(t?.collection_amount_target ?? 0));
    setEditingId(agent.id);
  };

  const saveTarget = async (agent: Agent) => {
    const val = parseFloat(editValue) || 0;
    // Both sales (down-payment) and CX targets are now dollar collection goals.
    const patch = { collection_amount_target: Math.max(0, val) };
    setSaving(true);
    const existing = getTarget(agent.id);
    if (existing?.id) {
      await dbOp('targets', 'update', patch, { id: existing.id });
      setTargets(prev => prev.map(t => t.id === existing.id ? { ...t, ...patch } : t));
    } else {
      const { data } = await dbOp('targets', 'insert', { user_id: agent.id, period, sales_count_target: 0, ...patch });
      if (data?.[0]) setTargets(prev => [...prev, data[0]]);
    }
    setEditingId(null);
    setSaving(false);
  };

  const salesAgents = agents.filter(a => a.role === 'sales');
  const cxAgents = agents.filter(a => a.role === 'cx');
  const isCxAgent = currentUserRole === 'cx';

  // Summary numbers — sales is now driven by down-payment collected (sum of Sale amounts)
  const teamSalesCollected = salesAgents.reduce((s, a) => s + getSalesRevenue(a.id), 0);
  const teamSalesTarget = salesAgents.reduce((s, a) => s + (getTarget(a.id)?.collection_amount_target ?? 0), 0);
  const teamSalesPct = teamSalesTarget > 0 ? Math.min(Math.round((teamSalesCollected / teamSalesTarget) * 100), 100) : 0;
  const teamSalesCommission = salesAgents.reduce((s, a) => s + salesCommission(getSalesRevenue(a.id)), 0);
  const teamCollections = cxAgents.reduce((s, a) => s + getCollected(a.id), 0);
  const teamCxBonus = cxAgents.reduce((s, a) => s + Math.floor(getCollected(a.id) / cxBonus.threshold) * cxBonus.amount, 0);

  if (isMgmt) {
    return (
      <div className="page-fade">
        {/* Tab selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['sales', 'cx'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setEditingId(null); }}
              className={activeTab === tab ? 'btn btn-acc' : 'btn btn-sec'}
              style={{ fontWeight: 600, fontSize: 13 }}
            >
              {tab === 'sales' ? 'Sales Targets' : 'Customer Service Targets'}
            </button>
          ))}
        </div>

        {/* ── SALES TAB ── */}
        {activeTab === 'sales' && (
          <>
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card" style={{ cursor: 'default' }}>
                <div className="stat-h"><div className="stat-ico ok">💰</div></div>
                <div className="stat-l">DOWN PAYMENT COLLECTED</div>
                <div className="stat-v">${teamSalesCollected.toLocaleString()}</div>
                <div className="stat-foot">{period}</div>
              </div>
              <div className="stat-card" style={{ cursor: 'default' }}>
                <div className="stat-h"><div className="stat-ico ind">🎯</div></div>
                <div className="stat-l">TEAM COMPLETION</div>
                <div className="stat-v" style={{ color: barColor(teamSalesPct) }}>{teamSalesPct}%</div>
                <div className="stat-foot">${teamSalesCollected.toLocaleString()} / ${teamSalesTarget.toLocaleString()}</div>
              </div>
              <div className="stat-card" style={{ cursor: 'default' }}>
                <div className="stat-h"><div className="stat-ico ok">🎁</div></div>
                <div className="stat-l">COMMISSION EARNED</div>
                <div className="stat-v" style={{ color: 'var(--ok)' }}>${teamSalesCommission.toLocaleString()}</div>
                <div className="stat-foot">Team total</div>
              </div>
            </div>

            {salesAgents.length > 0 && (
              <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
                <div className="card-hdr">
                  <div>
                    <div className="card-title">Sales Agent Progress</div>
                    <div className="card-sub">Down payment collected · Click a target to edit it</div>
                  </div>
                </div>
                <div style={{ padding: '0 18px 18px' }}>
                  {salesAgents.map(agent => {
                    const collected = getSalesRevenue(agent.id);
                    const commission = salesCommission(collected);
                    const targetAmt = getTarget(agent.id)?.collection_amount_target ?? 0;
                    const pct = targetAmt > 0 ? Math.min(Math.round((collected / targetAmt) * 100), 100) : 0;
                    return (
                      <AgentRow
                        key={agent.id}
                        agent={agent} collected={collected} commission={commission} targetAmt={targetAmt} pct={pct}
                        isMgmt={true} editingId={editingId} editValue={editValue} saving={saving}
                        setEditValue={setEditValue}
                        onStartEdit={() => startSalesEdit(agent)}
                        onSave={() => saveTarget(agent)}
                        onCancel={() => setEditingId(null)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Commission Ladder — sales tab only */}
            <div className="card">
              <div className="card-hdr">
                <div className="card-title">Commission Ladder</div>
                <div className="card-sub">Per ${COLLECT_UNIT} of down payment collected · rate steps up by tier</div>
              </div>
              <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {COMMISSION_TIERS.map(tier => (
                  <div key={tier.label} style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: 'var(--surface-2)',
                    border: '1.5px solid var(--line)',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 2 }}>{tier.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', marginBottom: 6 }}>{tier.range}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink-2)' }}>{tier.rate}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── CX TAB ── */}
        {activeTab === 'cx' && (
          <>
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card" style={{ cursor: 'default' }}>
                <div className="stat-h"><div className="stat-ico acc">💰</div></div>
                <div className="stat-l">TOTAL COLLECTIONS</div>
                <div className="stat-v">${teamCollections.toLocaleString()}</div>
                <div className="stat-foot">{period}</div>
              </div>
              <div className="stat-card" style={{ cursor: 'default' }}>
                <div className="stat-h"><div className="stat-ico ok">🎁</div></div>
                <div className="stat-l">CX BONUSES EARNED</div>
                <div className="stat-v" style={{ color: 'var(--ok)' }}>${teamCxBonus}</div>
                <div className="stat-foot">Team total</div>
              </div>
              <div className="stat-card" style={{ cursor: 'default' }}>
                <div className="stat-h"><div className="stat-ico ind">👥</div></div>
                <div className="stat-l">CX AGENTS</div>
                <div className="stat-v">{cxAgents.length}</div>
                <div className="stat-foot">Customer service team</div>
              </div>
            </div>

            {cxAgents.length > 0 && (
              <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
                <div className="card-hdr">
                  <div>
                    <div className="card-title">CX Collection Progress</div>
                    <div className="card-sub">${cxBonus.amount} bonus per ${cxBonus.threshold.toLocaleString()} collected · Click target to edit</div>
                  </div>
                </div>
                <div style={{ padding: '0 18px 18px' }}>
                  {cxAgents.map(agent => {
                    const collected = getCollected(agent.id);
                    const targetAmt = getTarget(agent.id)?.collection_amount_target ?? 0;
                    return (
                      <CxRow
                        key={agent.id}
                        agent={agent} collected={collected} targetAmt={targetAmt} cxBonus={cxBonus}
                        isMgmt={true} editingId={editingId} editValue={editValue} saving={saving}
                        setEditValue={setEditValue}
                        onStartEdit={() => startCxEdit(agent)}
                        onSave={() => saveTarget(agent)}
                        onCancel={() => setEditingId(null)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* CX Bonus Structure reference */}
            <div className="card">
              <div className="card-hdr">
                <div className="card-title">CX Bonus Structure</div>
                <div className="card-sub">Commission is calculated per collection milestone</div>
              </div>
              <div style={{ padding: '0 18px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ padding: '14px 20px', borderRadius: 10, background: 'oklch(0.96 0.04 145)', border: '1px solid oklch(0.88 0.07 145)' }}>
                    <div style={{ fontSize: 10, color: 'var(--ok)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>Bonus per milestone</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ok)' }}>${cxBonus.amount}</div>
                  </div>
                  <div style={{ color: 'var(--ink-4)', fontSize: 16, fontWeight: 500 }}>for every</div>
                  <div style={{ padding: '14px 20px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>Collection milestone</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>${cxBonus.threshold.toLocaleString()}</div>
                  </div>
                  <div style={{ color: 'var(--ink-4)', fontSize: 13, maxWidth: 260 }}>
                    collected. Bonuses stack — collecting ${(cxBonus.threshold * 3).toLocaleString()} earns ${cxBonus.amount * 3} in bonuses.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── AGENT VIEW (non-mgmt) ──
  if (isCxAgent) {
    const collected = getCollected(currentUserId);
    const targetAmt = getTarget(currentUserId)?.collection_amount_target ?? 0;
    const pct = targetAmt > 0 ? Math.min(Math.round((collected / targetAmt) * 100), 100) : 0;
    const bonus = Math.floor(collected / cxBonus.threshold) * cxBonus.amount;

    return (
      <div className="page-fade">
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className="stat-ico ok">$</div></div>
            <div className="stat-l">COLLECTED</div>
            <div className="stat-v" style={{ color: 'var(--ok)' }}>${collected.toLocaleString()}</div>
            <div className="stat-foot">{period}</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className="stat-ico ind">🎯</div></div>
            <div className="stat-l">TARGET</div>
            <div className="stat-v">{targetAmt > 0 ? `$${targetAmt.toLocaleString()}` : 'Not set'}</div>
            <div className="stat-foot">{targetAmt > 0 ? `${pct}% complete` : 'Ask your manager'}</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className="stat-ico ok">🎁</div></div>
            <div className="stat-l">BONUS EARNED</div>
            <div className="stat-v" style={{ color: 'var(--ok)' }}>${bonus}</div>
            <div className="stat-foot">{Math.floor(collected / cxBonus.threshold)} × ${cxBonus.amount}</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className="stat-ico acc">➡</div></div>
            <div className="stat-l">NEXT BONUS IN</div>
            <div className="stat-v">${(cxBonus.threshold - (collected % cxBonus.threshold)).toLocaleString()}</div>
            <div className="stat-foot">More to collect</div>
          </div>
        </div>

        {cxAgents.length > 0 && (
          <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
            <div className="card-hdr">
              <div>
                <div className="card-title">My Collection Progress</div>
                <div className="card-sub">{period}</div>
              </div>
            </div>
            <div style={{ padding: '0 18px 18px' }}>
              {cxAgents.filter(a => a.id === currentUserId).map(agent => {
                const agentCollected = getCollected(agent.id);
                const agentTarget = getTarget(agent.id)?.collection_amount_target ?? 0;
                return (
                  <CxRow
                    key={agent.id}
                    agent={agent} collected={agentCollected} targetAmt={agentTarget} cxBonus={cxBonus}
                    isMgmt={false} editingId={null} editValue="" saving={false}
                    setEditValue={() => {}}
                    onStartEdit={() => {}} onSave={() => {}} onCancel={() => {}}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* CX bonus reference — no commission ladder */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">Your Bonus Structure</div>
          </div>
          <div style={{ padding: '0 18px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ padding: '12px 18px', borderRadius: 10, background: 'oklch(0.96 0.04 145)', border: '1px solid oklch(0.88 0.07 145)', fontSize: 16, fontWeight: 800, color: 'var(--ok)' }}>
                ${cxBonus.amount} bonus
              </div>
              <div style={{ color: 'var(--ink-4)', fontSize: 14, fontWeight: 500 }}>for every</div>
              <div style={{ padding: '12px 18px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 16, fontWeight: 800 }}>
                ${cxBonus.threshold.toLocaleString()} collected
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── SALES AGENT VIEW ──
  const myCollected = getSalesRevenue(currentUserId);
  const myCommission = salesCommission(myCollected);
  const myTargetAmt = getTarget(currentUserId)?.collection_amount_target ?? 0;
  const pct = myTargetAmt > 0 ? Math.min(Math.round((myCollected / myTargetAmt) * 100), 100) : 0;
  const myUnits = Math.floor(myCollected / COLLECT_UNIT);
  const nextUnitIn = COLLECT_UNIT - (myCollected % COLLECT_UNIT);

  return (
    <div className="page-fade">
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">$</div></div>
          <div className="stat-l">DOWN PAYMENT COLLECTED</div>
          <div className="stat-v" style={{ color: 'var(--ok)' }}>${myCollected.toLocaleString()}</div>
          <div className="stat-foot">{period}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">🎯</div></div>
          <div className="stat-l">MY TARGET</div>
          <div className="stat-v">{myTargetAmt > 0 ? `$${myTargetAmt.toLocaleString()}` : 'Not set'}</div>
          <div className="stat-foot">{myTargetAmt > 0 ? `${pct}% complete` : 'Ask your manager'}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">🎁</div></div>
          <div className="stat-l">COMMISSION EARNED</div>
          <div className="stat-v" style={{ color: 'var(--ok)' }}>${myCommission.toLocaleString()}</div>
          <div className="stat-foot">{myUnits} × ${COLLECT_UNIT} collected</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico acc">➡</div></div>
          <div className="stat-l">NEXT ${COLLECT_UNIT} IN</div>
          <div className="stat-v">${nextUnitIn.toLocaleString()}</div>
          <div className="stat-foot">More to collect</div>
        </div>
      </div>

      {salesAgents.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
          <div className="card-hdr">
            <div>
              <div className="card-title">My Progress</div>
              <div className="card-sub">Your down payment collected this month · {period}</div>
            </div>
          </div>
          <div style={{ padding: '0 18px 18px' }}>
            {salesAgents.filter(a => a.id === currentUserId).map(agent => {
              const collected = getSalesRevenue(agent.id);
              const commission = salesCommission(collected);
              const targetAmt = getTarget(agent.id)?.collection_amount_target ?? 0;
              const p = targetAmt > 0 ? Math.min(Math.round((collected / targetAmt) * 100), 100) : 0;
              return (
                <AgentRow
                  key={agent.id}
                  agent={agent} collected={collected} commission={commission} targetAmt={targetAmt} pct={p}
                  isMgmt={false} editingId={null} editValue="" saving={false}
                  setEditValue={() => {}}
                  onStartEdit={() => {}} onSave={() => {}} onCancel={() => {}}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Commission Ladder — sales agents only */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">Commission Ladder</div>
          <div className="card-sub">Per ${COLLECT_UNIT} of down payment collected</div>
        </div>
        <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {COMMISSION_TIERS.map(tier => {
            const active = myUnits > tier.minUnits;
            const current = myUnits >= tier.minUnits && myUnits < tier.maxUnits;
            return (
              <div key={tier.label} style={{
                padding: '14px 16px', borderRadius: 10,
                background: current ? 'oklch(0.96 0.05 145)' : active ? 'oklch(0.97 0.02 145)' : 'var(--surface-2)',
                border: `1.5px solid ${current ? 'oklch(0.85 0.08 145)' : active ? 'oklch(0.90 0.04 145)' : 'var(--line)'}`,
              }}>
                <div style={{ fontSize: 11, color: current ? 'var(--ok)' : 'var(--ink-3)', fontWeight: 700, marginBottom: 2 }}>{tier.label}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-4)', marginBottom: 6 }}>{tier.range}</div>
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
