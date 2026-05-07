'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

type ApprovalSection = 'timeoff' | 'schedules' | 'payroll';

export default function ApprovalsClient({
  initialTimeoff,
  initialSchedules,
  initialPayrolls,
}: {
  initialTimeoff: any[];
  initialSchedules: any[];
  initialPayrolls: any[];
}) {
  const [timeoff, setTimeoff] = useState(initialTimeoff);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [payrolls, setPayrolls] = useState(initialPayrolls);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ApprovalSection>('timeoff');
  const [log, setLog] = useState<{ id: string; name: string; action: string; time: string }[]>([]);

  const handleAction = async (
    table: string,
    id: string,
    status: string,
    stateSetter: React.Dispatch<React.SetStateAction<any[]>>,
    itemName: string
  ) => {
    setBusy(id);
    await dbOp(table, 'update', { status }, { id });
    stateSetter(prev => prev.filter(item => item.id !== id));
    setLog(prev => [{ id, name: itemName, action: status, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev]);
    setBusy(null);
  };

  const totalPending = timeoff.length + schedules.length + payrolls.length;

  const SECTIONS = [
    { id: 'timeoff' as const, label: 'Time-Off', count: timeoff.length, hue: 75 },
    { id: 'schedules' as const, label: 'Schedules', count: schedules.length, hue: 268 },
    { id: 'payroll' as const, label: 'Payroll', count: payrolls.length, hue: 145 },
  ];

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">⏳</div></div>
          <div className="stat-l">TOTAL PENDING</div>
          <div className="stat-v" style={{ color: totalPending > 0 ? 'var(--warn)' : 'var(--ok)' }}>{totalPending}</div>
          <div className="stat-foot">Items awaiting action</div>
        </div>
        {SECTIONS.map(s => (
          <div key={s.id} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveSection(s.id)}>
            <div className="stat-h">
              <div className="stat-ico" style={{ background: `oklch(0.93 0.05 ${s.hue})`, color: `oklch(0.40 0.14 ${s.hue})` }}>◈</div>
            </div>
            <div className="stat-l">{s.label.toUpperCase()}</div>
            <div className="stat-v" style={{ color: s.count > 0 ? `oklch(0.40 0.14 ${s.hue})` : 'var(--ink-3)' }}>{s.count}</div>
            <div className="stat-foot">{s.count > 0 ? 'Needs review' : 'All clear'}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'flex-start' }}>
        {/* Main queue */}
        <div>
          {/* Section tabs */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-hdr">
              <div className="tabs" style={{ padding: 0, border: 'none', background: 'none' }}>
                {SECTIONS.map(s => (
                  <button key={s.id} className={`tab${activeSection === s.id ? ' active' : ''}`} onClick={() => setActiveSection(s.id)}>
                    {s.label} <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>{s.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time-off */}
            {activeSection === 'timeoff' && (
              <>
                {timeoff.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                    ✓ No pending time-off requests
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="tbl">
                      <thead><tr><th>Employee</th><th>Type</th><th>Period</th><th>Reason</th><th>Actions</th></tr></thead>
                      <tbody>
                        {timeoff.map(t => {
                          const hue = ((t.profiles?.name ?? 'U').charCodeAt(0) * 13) % 360;
                          return (
                            <tr key={t.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div className="av-circle" style={{ width: 30, height: 30, fontSize: 10, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                                    {(t.profiles?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                  </div>
                                  <span style={{ fontWeight: 600 }}>{t.profiles?.name ?? 'Unknown'}</span>
                                </div>
                              </td>
                              <td><span className="bdg bdg-warn">{t.type}</span></td>
                              <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>{t.start_date} → {t.end_date}</td>
                              <td style={{ fontSize: 12, color: 'var(--ink-3)', maxWidth: 160 }}>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.reason ?? '—'}</div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button className="btn btn-sm" style={{ background: 'oklch(0.96 0.05 145)', color: 'var(--ok)', border: '1px solid oklch(0.88 0.07 145)' }} disabled={busy === t.id} onClick={() => handleAction('time_off_requests', t.id, 'Approved', setTimeoff, t.profiles?.name ?? 'Unknown')}>✓</button>
                                  <button className="btn btn-sm" style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)' }} disabled={busy === t.id} onClick={() => handleAction('time_off_requests', t.id, 'Rejected', setTimeoff, t.profiles?.name ?? 'Unknown')}>✕</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* Schedules */}
            {activeSection === 'schedules' && (
              <>
                {schedules.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                    ✓ No pending schedule submissions
                  </div>
                ) : (
                  <div style={{ padding: '0 18px 18px' }}>
                    {schedules.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line-2)' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'oklch(0.94 0.05 268)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📅</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{s.team || 'Team Schedule'}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>Week of {s.week || s.created_at?.split('T')[0]}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm" style={{ background: 'oklch(0.96 0.05 145)', color: 'var(--ok)', border: '1px solid oklch(0.88 0.07 145)' }} disabled={busy === s.id} onClick={() => handleAction('schedules', s.id, 'Approved', setSchedules, 'Schedule')}>✓ Approve</button>
                          <button className="btn btn-sm" style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)' }} disabled={busy === s.id} onClick={() => handleAction('schedules', s.id, 'Rejected', setSchedules, 'Schedule')}>✕ Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Payroll */}
            {activeSection === 'payroll' && (
              <>
                {payrolls.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                    ✓ No payroll drafts pending approval
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="tbl">
                      <thead><tr><th>Employee</th><th>Period</th><th>Base</th><th>Deductions</th><th>Net Pay</th><th>Actions</th></tr></thead>
                      <tbody>
                        {payrolls.map(p => {
                          const hue = ((p.profiles?.name ?? 'U').charCodeAt(0) * 13) % 360;
                          return (
                            <tr key={p.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div className="av-circle" style={{ width: 30, height: 30, fontSize: 10, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                                    {(p.profiles?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                  </div>
                                  <span style={{ fontWeight: 600 }}>{p.profiles?.name ?? 'Employee'}</span>
                                </div>
                              </td>
                              <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>{p.period}</td>
                              <td>${Number(p.base_salary).toLocaleString()}</td>
                              <td style={{ color: 'var(--err)' }}>−${Number(p.deductions).toLocaleString()}</td>
                              <td style={{ fontWeight: 700, color: 'var(--ok)' }}>${Number(p.net_pay).toLocaleString()}</td>
                              <td>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button className="btn btn-sm" style={{ background: 'oklch(0.96 0.05 145)', color: 'var(--ok)', border: '1px solid oklch(0.88 0.07 145)' }} disabled={busy === p.id} onClick={() => handleAction('payrolls', p.id, 'Approved', setPayrolls, p.profiles?.name ?? 'Employee')}>✓</button>
                                  <button className="btn btn-sm" style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)' }} disabled={busy === p.id} onClick={() => handleAction('payrolls', p.id, 'Rejected', setPayrolls, p.profiles?.name ?? 'Employee')}>✕</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Decision log sidebar */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title" style={{ fontSize: 13 }}>Decision Log</div>
          </div>
          <div style={{ padding: '0 14px 14px' }}>
            {log.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-4)', padding: '16px 0', textAlign: 'center' }}>
                Decisions appear here in real-time
              </div>
            ) : (
              log.map((entry, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: entry.action === 'Approved' ? 'oklch(0.96 0.05 145)' : 'oklch(0.97 0.03 25)',
                    color: entry.action === 'Approved' ? 'var(--ok)' : 'var(--err)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                  }}>
                    {entry.action === 'Approved' ? '✓' : '✕'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{entry.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>{entry.action} · {entry.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
