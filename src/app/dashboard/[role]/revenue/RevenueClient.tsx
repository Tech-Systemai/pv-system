'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

type Agent = { id: string; name: string; role: string };
type Target = { id?: string; user_id: string; period: string; sales_count_target: number; collection_amount_target?: number };
type CxBonus = { amount: number; threshold: number };

function barColor(pct: number) {
  return pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--accent)' : 'var(--warn)';
}

// ---------- Management view ----------

function MgmtRevenueView({
  salesAgents, cxAgents, targets: initTargets, salesLogs, collectionLogs, allSalesLogs, allCollectionLogs, canManageLogs, period, cxBonus: initBonus,
}: {
  salesAgents: Agent[]; cxAgents: Agent[];
  targets: Target[]; salesLogs: any[]; collectionLogs: any[];
  allSalesLogs: any[]; allCollectionLogs: any[]; canManageLogs: boolean;
  period: string; cxBonus: CxBonus;
}) {
  const [tab, setTab] = useState<'sales' | 'cx' | 'logs' | 'collogs'>('sales');
  const [targets, setTargets] = useState<Target[]>(initTargets);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<'sales' | 'cx'>('sales');
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [cxBonus, setCxBonus] = useState<CxBonus>(initBonus);
  const [editBonus, setEditBonus] = useState(false);
  const [bonusDraft, setBonusDraft] = useState({ amount: String(initBonus.amount), threshold: String(initBonus.threshold) });
  const [savingBonus, setSavingBonus] = useState(false);

  // Owner/Admin sale-log review
  const [logs, setLogs] = useState<any[]>(allSalesLogs);
  const [busyLog, setBusyLog] = useState<string | null>(null);

  const setLogStatus = async (id: string, status: 'Verified' | 'Declined') => {
    setBusyLog(id);
    await dbOp('sales_logs', 'update', { status }, { id });
    setLogs(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    setBusyLog(null);
  };

  const deleteLog = async (id: string) => {
    if (!window.confirm('Delete this sale log permanently? This cannot be undone.')) return;
    setBusyLog(id);
    await dbOp('sales_logs', 'delete', undefined, { id });
    setLogs(prev => prev.filter(l => l.id !== id));
    setBusyLog(null);
  };

  // Owner/Admin collection-log review (auto-logged from CX live-card payments)
  const [collLogs, setCollLogs] = useState<any[]>(allCollectionLogs);
  const [busyColl, setBusyColl] = useState<string | null>(null);

  const setCollStatus = async (id: string, status: 'Verified' | 'Declined') => {
    setBusyColl(id);
    await dbOp('sales_logs', 'update', { status }, { id });
    setCollLogs(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    setBusyColl(null);
  };

  const deleteColl = async (id: string) => {
    if (!window.confirm('Delete this collection log permanently? This cannot be undone.')) return;
    setBusyColl(id);
    await dbOp('sales_logs', 'delete', undefined, { id });
    setCollLogs(prev => prev.filter(l => l.id !== id));
    setBusyColl(null);
  };

  const getTarget = (userId: string) => targets.find(t => t.user_id === userId);
  const getSalesCount = (userId: string) => salesLogs.filter(s => s.user_id === userId).length;
  const getSalesRevenue = (userId: string) => salesLogs.filter(s => s.user_id === userId).reduce((s, l) => s + Number(l.amount), 0);
  const getCollected = (userId: string) => collectionLogs.filter(c => c.user_id === userId).reduce((s, c) => s + Number(c.amount), 0);

  const startEdit = (agentId: string, field: 'sales' | 'cx') => {
    const t = getTarget(agentId);
    setEditValue(field === 'sales' ? String(t?.sales_count_target ?? 50) : String(t?.collection_amount_target ?? 0));
    setEditField(field);
    setEditingId(agentId);
  };

  const saveTarget = async (agent: Agent) => {
    const val = parseFloat(editValue) || 0;
    const patch = editField === 'sales'
      ? { sales_count_target: Math.max(1, val) }
      : { collection_amount_target: Math.max(0, val) };
    setSaving(true);
    const existing = getTarget(agent.id);
    if (existing?.id) {
      await dbOp('targets', 'update', patch, { id: existing.id });
      setTargets(prev => prev.map(t => t.id === existing.id ? { ...t, ...patch } : t));
    } else {
      const { data } = await dbOp('targets', 'insert', { user_id: agent.id, period, sales_count_target: 0, collection_amount_target: 0, ...patch });
      if (data?.[0]) setTargets(prev => [...prev, data[0]]);
    }
    setEditingId(null);
    setSaving(false);
  };

  const saveBonus = async () => {
    setSavingBonus(true);
    const newBonus: CxBonus = {
      amount: parseFloat(bonusDraft.amount) || 3,
      threshold: parseFloat(bonusDraft.threshold) || 600,
    };
    await dbOp('global_settings', 'upsert', { key: 'cx_bonus', value: newBonus });
    setCxBonus(newBonus);
    setEditBonus(false);
    setSavingBonus(false);
  };

  const totalSalesRevenue = salesLogs.reduce((s, l) => s + Number(l.amount), 0);
  const totalSalesCount = salesLogs.length;
  const totalCollections = collectionLogs.reduce((s, c) => s + Number(c.amount), 0);
  const totalCxBonus = cxAgents.reduce((s, a) => s + Math.floor(getCollected(a.id) / cxBonus.threshold) * cxBonus.amount, 0);

  const InlineEdit = ({ agentId, field, currentVal, fmt }: { agentId: string; field: 'sales' | 'cx'; currentVal: number; fmt?: (n: number) => string }) => {
    const display = fmt ? fmt(currentVal) : String(currentVal);
    if (editingId === agentId && editField === field) {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number" value={editValue}
            onChange={e => setEditValue(e.target.value)}
            style={{ width: field === 'cx' ? 80 : 54, fontSize: 12, textAlign: 'center', border: '1px solid var(--accent)', borderRadius: 5, padding: '2px 4px' }}
            min={0} autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') saveTarget({ id: agentId, name: '', role: '' });
              if (e.key === 'Escape') setEditingId(null);
            }}
          />
          <button className="btn btn-acc btn-sm" style={{ padding: '3px 8px' }} disabled={saving} onClick={() => saveTarget({ id: agentId, name: '', role: '' })}>✓</button>
          <button className="btn btn-sec btn-sm" style={{ padding: '3px 8px' }} onClick={() => setEditingId(null)}>✕</button>
        </span>
      );
    }
    return (
      <span
        style={{ fontWeight: 600, color: 'var(--ink-3)', fontSize: 13, cursor: 'pointer', borderBottom: '1px dashed var(--line)' }}
        onClick={() => startEdit(agentId, field)}
      >{display}</span>
    );
  };

  return (
    <div className="page-fade">
      {/* Summary stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">$</div></div>
          <div className="stat-l">SALES REVENUE</div>
          <div className="stat-v" style={{ color: 'var(--ok)' }}>${totalSalesRevenue.toLocaleString()}</div>
          <div className="stat-foot">{period}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico acc">📊</div></div>
          <div className="stat-l">TOTAL SALES</div>
          <div className="stat-v">{totalSalesCount}</div>
          <div className="stat-foot">{salesAgents.length} sales agents</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">💰</div></div>
          <div className="stat-l">CX COLLECTIONS</div>
          <div className="stat-v">${totalCollections.toLocaleString()}</div>
          <div className="stat-foot">{period}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">🎁</div></div>
          <div className="stat-l">CX BONUSES</div>
          <div className="stat-v" style={{ color: 'var(--ok)' }}>${totalCxBonus}</div>
          <div className="stat-foot">Total earned this period</div>
        </div>
      </div>

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['sales', 'cx', ...(canManageLogs ? ['logs', 'collogs'] as const : [])] as const).map(t => {
          const pendingCount = t === 'logs'
            ? logs.filter(l => (l.status ?? 'Pending') === 'Pending').length
            : t === 'collogs'
            ? collLogs.filter(l => (l.status ?? 'Pending') === 'Pending').length
            : 0;
          return (
            <button
              key={t}
              onClick={() => { setTab(t); setEditingId(null); }}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                background: tab === t ? 'var(--accent)' : 'var(--surface-2)',
                color: tab === t ? '#fff' : 'var(--ink-3)',
                transition: 'all .2s',
              }}
            >
              {t === 'sales' ? '📈 Sales Targets' : t === 'cx' ? '📋 CX Collection Targets' : t === 'logs' ? `🧾 All Sales Logs${pendingCount > 0 ? ` (${pendingCount})` : ''}` : `💰 All Collections${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
            </button>
          );
        })}
      </div>

      {/* Sales targets */}
      {tab === 'sales' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div>
              <div className="card-title">Sales Team Targets</div>
              <div className="card-sub">Click target number to edit · {period}</div>
            </div>
          </div>
          <div style={{ padding: '0 18px 18px' }}>
            {salesAgents.length === 0 && (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No sales agents found.</div>
            )}
            {salesAgents.map(agent => {
              const count = getSalesCount(agent.id);
              const revenue = getSalesRevenue(agent.id);
              const targetCount = getTarget(agent.id)?.sales_count_target ?? 50;
              const pct = Math.min(Math.round((count / targetCount) * 100), 100);
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
                        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Revenue: <span style={{ color: 'var(--ok)', fontWeight: 700 }}>${revenue.toLocaleString()}</span></div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 9.5, color: 'var(--ink-4)', textTransform: 'uppercase', fontWeight: 600 }}>Sales / Target</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontWeight: 700, color: barColor(pct), fontSize: 14 }}>{count}</span>
                          <span style={{ color: 'var(--ink-4)' }}>/</span>
                          <InlineEdit agentId={agent.id} field="sales" currentVal={targetCount} />
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
      )}

      {/* CX collection targets */}
      {tab === 'cx' && (
        <>
          {/* CX bonus settings */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-hdr">
              <div className="card-title">CX Bonus Structure</div>
              {!editBonus && (
                <button
                  className="btn btn-sec btn-sm"
                  onClick={() => {
                    setBonusDraft({ amount: String(cxBonus.amount), threshold: String(cxBonus.threshold) });
                    setEditBonus(true);
                  }}
                >Edit</button>
              )}
            </div>
            <div style={{ padding: '0 18px 18px' }}>
              {editBonus ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Every</span>
                  <div className="pv-fld" style={{ margin: 0, width: 100 }}>
                    <label>Threshold ($)</label>
                    <input type="number" value={bonusDraft.threshold} min={1} step={1} onChange={e => setBonusDraft(b => ({ ...b, threshold: e.target.value }))} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>collected earns</span>
                  <div className="pv-fld" style={{ margin: 0, width: 100 }}>
                    <label>Bonus ($)</label>
                    <input type="number" value={bonusDraft.amount} min={0} step={0.5} onChange={e => setBonusDraft(b => ({ ...b, amount: e.target.value }))} />
                  </div>
                  <button className="btn btn-acc btn-sm" disabled={savingBonus} onClick={saveBonus}>{savingBonus ? 'Saving…' : 'Save'}</button>
                  <button className="btn btn-sec btn-sm" onClick={() => setEditBonus(false)}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ padding: '10px 16px', borderRadius: 10, background: 'oklch(0.96 0.04 145)', border: '1px solid oklch(0.88 0.07 145)', fontSize: 15, fontWeight: 800, color: 'var(--ok)' }}>
                    ${cxBonus.amount} bonus
                  </div>
                  <div style={{ color: 'var(--ink-4)', fontSize: 13, fontWeight: 500 }}>for every</div>
                  <div style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 15, fontWeight: 800 }}>
                    ${cxBonus.threshold.toLocaleString()} collected
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CX agent list */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-hdr">
              <div>
                <div className="card-title">CX Collection Targets</div>
                <div className="card-sub">Click target amount to edit · {period}</div>
              </div>
            </div>
            <div style={{ padding: '0 18px 18px' }}>
              {cxAgents.length === 0 && (
                <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No CX agents found.</div>
              )}
              {cxAgents.map(agent => {
                const collected = getCollected(agent.id);
                const targetAmt = getTarget(agent.id)?.collection_amount_target ?? 0;
                const pct = targetAmt > 0 ? Math.min(Math.round((collected / targetAmt) * 100), 100) : 0;
                const bonus = Math.floor(collected / cxBonus.threshold) * cxBonus.amount;
                const hue = (agent.name.charCodeAt(0) * 13) % 360;
                return (
                  <div key={agent.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--line-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: targetAmt > 0 ? 8 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="av-circle" style={{ width: 34, height: 34, fontSize: 11, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                          {agent.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{agent.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                            Bonus earned: <span style={{ color: 'var(--ok)', fontWeight: 700 }}>${bonus}</span>
                            {' '}· {Math.floor(collected / cxBonus.threshold)} × ${cxBonus.amount}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 9.5, color: 'var(--ink-4)', textTransform: 'uppercase', fontWeight: 600 }}>Collected / Target</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontWeight: 700, color: barColor(pct), fontSize: 14 }}>${collected.toLocaleString()}</span>
                            <span style={{ color: 'var(--ink-4)' }}>/</span>
                            <InlineEdit agentId={agent.id} field="cx" currentVal={targetAmt} fmt={n => `$${n.toLocaleString()}`} />
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
              })}
            </div>
          </div>
        </>
      )}

      {/* All sales logs — owner/admin review, approve & delete */}
      {tab === 'logs' && canManageLogs && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div>
              <div className="card-title">All Sales Logs</div>
              <div className="card-sub">Only approved logs count toward commission · Delete inaccurate ones · {period}</div>
            </div>
          </div>
          {logs.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              No sales logged this period.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Customer</th>
                    <th>Location</th>
                    <th>Date / Time</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => {
                    const status = l.status ?? 'Pending';
                    return (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{l.profiles?.name ?? '—'}</td>
                        <td>
                          <div style={{ fontSize: 13 }}>{l.customer_name || l.customer_email || '—'}</div>
                          {l.customer_name && l.customer_email && (
                            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{l.customer_email}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>{l.payment_location || '—'}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>
                          {new Date(l.created_at).toLocaleString()}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--ok)', fontSize: 14 }}>
                          ${Number(l.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span className={status === 'Verified' ? 'bdg bdg-ok' : status === 'Declined' ? 'bdg bdg-err' : 'bdg bdg-warn'}>{status}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {status !== 'Verified' && (
                              <button className="btn btn-sm" style={{ background: 'oklch(0.96 0.05 145)', color: 'var(--ok)', border: '1px solid oklch(0.88 0.07 145)' }}
                                disabled={busyLog === l.id} onClick={() => setLogStatus(l.id, 'Verified')}>
                                {busyLog === l.id ? '…' : '✓ Approve'}
                              </button>
                            )}
                            {status === 'Pending' && (
                              <button className="btn btn-sm btn-sec"
                                disabled={busyLog === l.id} onClick={() => setLogStatus(l.id, 'Declined')}>
                                ✕ Decline
                              </button>
                            )}
                            <button className="btn btn-sm" style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)' }}
                              disabled={busyLog === l.id} onClick={() => deleteLog(l.id)}>
                              🗑 Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All collections — owner/admin verify, decline & delete */}
      {tab === 'collogs' && canManageLogs && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div>
              <div className="card-title">All Collections</div>
              <div className="card-sub">Auto-logged from payments agents record on the live card · Only verified collections count toward commission · {period}</div>
            </div>
          </div>
          {collLogs.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              No collections logged this period.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Date / Time</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {collLogs.map(l => {
                    const status = l.status ?? 'Pending';
                    return (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{l.profiles?.name ?? '—'}</td>
                        <td>
                          <div style={{ fontSize: 13 }}>{l.customer_name || l.customer_email || '—'}</div>
                          {l.customer_phone && (
                            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{l.customer_phone}</div>
                          )}
                        </td>
                        <td>{l.collection_type ? <span className="bdg bdg-acc">{l.collection_type}</span> : '—'}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>
                          {new Date(l.created_at).toLocaleString()}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--ok)', fontSize: 14 }}>
                          ${Number(l.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span className={status === 'Verified' ? 'bdg bdg-ok' : status === 'Declined' ? 'bdg bdg-err' : 'bdg bdg-warn'}>{status}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {status !== 'Verified' && (
                              <button className="btn btn-sm" style={{ background: 'oklch(0.96 0.05 145)', color: 'var(--ok)', border: '1px solid oklch(0.88 0.07 145)' }}
                                disabled={busyColl === l.id} onClick={() => setCollStatus(l.id, 'Verified')}>
                                {busyColl === l.id ? '…' : '✓ Verify'}
                              </button>
                            )}
                            {status === 'Pending' && (
                              <button className="btn btn-sm btn-sec"
                                disabled={busyColl === l.id} onClick={() => setCollStatus(l.id, 'Declined')}>
                                ✕ Decline
                              </button>
                            )}
                            <button className="btn btn-sm" style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)' }}
                              disabled={busyColl === l.id} onClick={() => deleteColl(l.id)}>
                              🗑 Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Agent revenue view ----------

function AgentRevenueView({ initialSales, currentUserId }: { initialSales: any[]; currentUserId: string }) {
  const [sales, setSales] = useState(initialSales);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const newSale = {
      user_id: currentUserId,
      customer_name: fd.get('customer_name') as string || null,
      customer_email: fd.get('customer_email') as string || null,
      customer_phone: fd.get('customer_phone') as string || null,
      payment_location: fd.get('payment_location') as string || null,
      amount: parseFloat(fd.get('amount') as string),
      type: 'Sale',
      status: 'Pending',
    };
    const { data, error: err } = await dbOp('sales_logs', 'insert', newSale);
    if (err) {
      setError(err);
    } else if (data?.[0]) {
      setSales(prev => [data[0], ...prev]);
      (e.target as HTMLFormElement).reset();
    }
    setIsSubmitting(false);
  };

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const verified = sales.filter(s => s.status === 'Verified').length;
  const pending = sales.length - verified;
  const today = new Date().toDateString();
  const todayTotal = sales
    .filter(s => new Date(s.created_at).toDateString() === today)
    .reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div className="page-fade">
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">$</div></div>
          <div className="stat-l">TOTAL LOGGED</div>
          <div className="stat-v" style={{ color: 'var(--ok)' }}>${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="stat-foot">All-time revenue</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">VERIFIED</div>
          <div className="stat-v">{verified}</div>
          <div className="stat-foot">Confirmed sales</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">⏳</div></div>
          <div className="stat-l">PENDING</div>
          <div className="stat-v" style={{ color: 'var(--warn)' }}>{pending}</div>
          <div className="stat-foot">Awaiting verification</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📅</div></div>
          <div className="stat-l">TODAY</div>
          <div className="stat-v">${todayTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="stat-foot">Logged today</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-hdr">
          <div className="card-title">Log New Sale</div>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          {error && (
            <div style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <form onSubmit={handleLog}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Customer Name</label>
                <input type="text" name="customer_name" required placeholder="Full name" />
              </div>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Customer Email</label>
                <input type="email" name="customer_email" placeholder="name@example.com" />
              </div>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Customer Phone</label>
                <input type="tel" name="customer_phone" placeholder="+1 555 000 0000" />
              </div>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Payment Location</label>
                <input type="text" name="payment_location" placeholder="e.g. Downtown Clinic" />
              </div>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Amount ($)</label>
                <input type="number" name="amount" step="0.01" min="0.01" required placeholder="0.00" />
              </div>
            </div>
            <button type="submit" className="btn btn-acc" disabled={isSubmitting}>
              {isSubmitting ? 'Logging…' : '+ Log Sale →'}
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Recent Sales</div>
            <div className="card-sub">{sales.length} total entries</div>
          </div>
        </div>
        {sales.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No sales logged yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Date / Time</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'oklch(0.96 0.05 145)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ok)', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>$</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{s.customer_name || s.customer_email || '—'}</div>
                          {s.customer_name && s.customer_email && (
                            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.customer_email}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>{s.customer_phone || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>{s.payment_location || '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--ok)', fontSize: 14 }}>
                      ${Number(s.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={s.status === 'Verified' ? 'bdg bdg-ok' : 'bdg bdg-warn'}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Root export ----------

export default function RevenueClient({
  isMgmt = false,
  canManageLogs = false,
  initialSales,
  currentUserId,
  salesAgents,
  cxAgents,
  targets,
  salesLogs,
  collectionLogs,
  allSalesLogs,
  allCollectionLogs,
  period,
  cxBonus,
}: {
  isMgmt?: boolean;
  canManageLogs?: boolean;
  initialSales: any[];
  currentUserId: string;
  salesAgents?: any[];
  cxAgents?: any[];
  targets?: any[];
  salesLogs?: any[];
  collectionLogs?: any[];
  allSalesLogs?: any[];
  allCollectionLogs?: any[];
  period?: string;
  cxBonus?: CxBonus;
}) {
  if (isMgmt) {
    return (
      <MgmtRevenueView
        salesAgents={salesAgents ?? []}
        cxAgents={cxAgents ?? []}
        targets={targets ?? []}
        salesLogs={salesLogs ?? []}
        collectionLogs={collectionLogs ?? []}
        allSalesLogs={allSalesLogs ?? []}
        allCollectionLogs={allCollectionLogs ?? []}
        canManageLogs={canManageLogs}
        period={period ?? ''}
        cxBonus={cxBonus ?? { amount: 3, threshold: 600 }}
      />
    );
  }
  return <AgentRevenueView initialSales={initialSales} currentUserId={currentUserId} />;
}
