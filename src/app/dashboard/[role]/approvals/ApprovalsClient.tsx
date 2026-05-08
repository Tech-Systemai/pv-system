'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

type ApprovalSection = 'timeoff' | 'schedules' | 'payroll' | 'documents';

const mono = { fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' } as const;
const approveStyle = { background: 'oklch(0.96 0.05 145)', color: 'var(--ok)', border: '1px solid oklch(0.88 0.07 145)' } as const;
const rejectStyle  = { background: 'oklch(0.97 0.03 25)',  color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)'  } as const;
const ROLE_HUES: Record<string, number> = { sales: 75, cx: 200, supervisor: 268, admin: 290, accountant: 155 };
const DAYS_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function EmptyState({ label }: { label: string }) {
  return <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>✓ {label}</div>;
}

function AvCell({ name, hue }: { name: string; hue: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div className="av-circle" style={{ width: 30, height: 30, fontSize: 10, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
        {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
      </div>
      <span style={{ fontWeight: 600 }}>{name}</span>
    </div>
  );
}

function ActionBtns({ id, busy, onApprove, onReject }: { id: string; busy: string | null; onApprove: () => void; onReject: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button className="btn btn-sm" style={approveStyle} disabled={busy === id} onClick={onApprove}>
        {busy === id ? '…' : '✓ Approve'}
      </button>
      <button className="btn btn-sm" style={rejectStyle} disabled={busy === id} onClick={onReject}>
        {busy === id ? '…' : '✕ Reject'}
      </button>
    </div>
  );
}

export default function ApprovalsClient({
  initialTimeoff,
  initialSchedules,
  initialPayrolls,
  initialDocs,
}: {
  initialTimeoff: any[];
  initialSchedules: any[];
  initialPayrolls: any[];
  initialDocs: any[];
}) {
  const [timeoff,   setTimeoff]   = useState(initialTimeoff);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [payrolls,  setPayrolls]  = useState(initialPayrolls);
  const [docs,      setDocs]      = useState(initialDocs);
  const [busy,      setBusy]      = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ApprovalSection>('timeoff');
  const [expandedDoc,   setExpandedDoc]   = useState<string | null>(null);
  const [log, setLog] = useState<{ id: string; name: string; action: string; time: string }[]>([]);

  const addLog = (name: string, action: string) =>
    setLog(prev => [{ id: Date.now().toString(), name, action, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleTimeoffAction = async (id: string, status: string, name: string) => {
    setBusy(id);
    await dbOp('time_off_requests', 'update', { status }, { id });
    setTimeoff(prev => prev.filter(t => t.id !== id));
    addLog(name, status);
    setBusy(null);
  };

  const handlePayrollAction = async (id: string, status: string, name: string) => {
    setBusy(id);
    await dbOp('payrolls', 'update', { status }, { id });
    setPayrolls(prev => prev.filter(p => p.id !== id));
    addLog(name, status);
    setBusy(null);
  };

  const handleScheduleWeek = async (week: string, status: string) => {
    setBusy(week);
    const weekShifts = schedules.filter(s => s.week === week);
    await Promise.all(weekShifts.map(s => dbOp('schedules', 'update', { status }, { id: s.id })));
    setSchedules(prev => prev.filter(s => s.week !== week));
    addLog(`Schedule week of ${week}`, status);
    setBusy(null);
  };

  const handleDocAction = async (doc: any, approvalStatus: 'approved' | 'rejected') => {
    setBusy(doc.id);
    await dbOp('inbox_documents', 'update', { approval_status: approvalStatus }, { id: doc.id });
    setDocs(prev => prev.filter(d => d.id !== doc.id));
    const statusLabel = approvalStatus === 'approved' ? 'Approved' : 'Rejected';
    addLog(`${doc.type ?? 'Document'} for ${doc.profiles?.name ?? 'employee'}`, statusLabel);
    setBusy(null);
  };

  // ─── Schedule grouping ───────────────────────────────────────────────────────
  const scheduleWeeks = schedules.reduce((acc: Record<string, any[]>, s) => {
    const wk = s.week ?? 'Unknown';
    if (!acc[wk]) acc[wk] = [];
    acc[wk].push(s);
    return acc;
  }, {});

  const weekCount = Object.keys(scheduleWeeks).length;
  const totalPending = timeoff.length + weekCount + payrolls.length + docs.length;

  const SECTIONS = [
    { id: 'timeoff'   as const, label: 'Time-Off',  count: timeoff.length,  hue: 75  },
    { id: 'schedules' as const, label: 'Schedules', count: weekCount,        hue: 268 },
    { id: 'payroll'   as const, label: 'Payroll',   count: payrolls.length,  hue: 145 },
    { id: 'documents' as const, label: 'Documents', count: docs.length,      hue: 220 },
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
        <div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Section tabs */}
            <div className="card-hdr">
              <div className="tabs" style={{ padding: 0, border: 'none', background: 'none' }}>
                {SECTIONS.map(s => (
                  <button key={s.id} className={`tab${activeSection === s.id ? ' active' : ''}`} onClick={() => setActiveSection(s.id)}>
                    {s.label} <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>{s.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Time-Off ────────────────────────────────────────────────────── */}
            {activeSection === 'timeoff' && (
              timeoff.length === 0
                ? <EmptyState label="No pending time-off requests" />
                : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Employee</th><th>Type</th><th>From</th><th>To</th>
                          <th>Days</th><th>Reason</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timeoff.map(t => {
                          const hue = ((t.profiles?.name ?? 'U').charCodeAt(0) * 13) % 360;
                          const days = t.start_date && t.end_date
                            ? Math.max(1, Math.round((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000) + 1)
                            : '—';
                          return (
                            <tr key={t.id}>
                              <td><AvCell name={t.profiles?.name ?? 'Unknown'} hue={hue} /></td>
                              <td><span className="bdg bdg-warn">{t.type}</span></td>
                              <td style={mono}>{t.start_date}</td>
                              <td style={mono}>{t.end_date}</td>
                              <td style={{ fontWeight: 600, fontSize: 13 }}>{days}</td>
                              <td style={{ fontSize: 12, color: 'var(--ink-3)', maxWidth: 180 }}>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.reason ?? '—'}</div>
                              </td>
                              <td>
                                <ActionBtns id={t.id} busy={busy}
                                  onApprove={() => handleTimeoffAction(t.id, 'Approved', t.profiles?.name ?? 'Unknown')}
                                  onReject={() => handleTimeoffAction(t.id, 'Rejected', t.profiles?.name ?? 'Unknown')}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
            )}

            {/* ─── Schedules ───────────────────────────────────────────────────── */}
            {activeSection === 'schedules' && (
              weekCount === 0
                ? <EmptyState label="No pending schedule submissions" />
                : (
                  <div style={{ padding: '0 18px 18px' }}>
                    {Object.entries(scheduleWeeks)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([week, shifts]) => {
                        const sorted = [...shifts].sort((a, b) => {
                          const di = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
                          return di !== 0 ? di : (a.profiles?.name ?? '').localeCompare(b.profiles?.name ?? '');
                        });
                        const submitter = shifts[0]?.submitted_by_name;
                        const isBusy = busy === week;
                        return (
                          <div key={week} style={{ marginBottom: 20, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                            {/* Week header */}
                            <div style={{ background: 'oklch(0.95 0.03 268)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>📅 Week of {week}</div>
                                {submitter && (
                                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                                    Submitted by <strong>{submitter}</strong>
                                  </div>
                                )}
                              </div>
                              <span className="bdg bdg-warn" style={{ fontSize: 10 }}>
                                {shifts.length} shift{shifts.length !== 1 ? 's' : ''}
                              </span>
                            </div>

                            {/* Shift detail table */}
                            <div style={{ overflowX: 'auto' }}>
                              <table className="tbl" style={{ margin: 0 }}>
                                <thead>
                                  <tr>
                                    <th>Employee</th><th>Team</th><th>Day</th>
                                    <th>Shift Start</th><th>Shift End</th><th>Hours</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sorted.map(s => {
                                    const hue = ((s.profiles?.name ?? 'U').charCodeAt(0) * 13) % 360;
                                    const roleHue = ROLE_HUES[s.team] ?? 200;
                                    let hrs: number | null = null;
                                    if (s.shift_start && s.shift_end) {
                                      const [sh, sm] = s.shift_start.split(':').map(Number);
                                      const [eh, em] = s.shift_end.split(':').map(Number);
                                      hrs = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                                    }
                                    return (
                                      <tr key={s.id}>
                                        <td><AvCell name={s.profiles?.name ?? 'Employee'} hue={hue} /></td>
                                        <td>
                                          <span className="bdg" style={{ background: `oklch(0.94 0.04 ${roleHue})`, color: `oklch(0.38 0.12 ${roleHue})` }}>
                                            {s.team ?? '—'}
                                          </span>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{s.day}</td>
                                        <td style={mono}>{s.shift_start ?? '—'}</td>
                                        <td style={mono}>{s.shift_end ?? '—'}</td>
                                        <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                                          {hrs !== null ? `${hrs}h` : '—'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Week approve/reject */}
                            <div style={{ padding: '10px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--line-2)', background: 'var(--bg-soft)' }}>
                              <button className="btn btn-sm" style={approveStyle} disabled={isBusy} onClick={() => handleScheduleWeek(week, 'Approved')}>
                                {isBusy ? '…' : '✓ Approve Week'}
                              </button>
                              <button className="btn btn-sm" style={rejectStyle} disabled={isBusy} onClick={() => handleScheduleWeek(week, 'Rejected')}>
                                {isBusy ? '…' : '✕ Reject'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )
            )}

            {/* ─── Payroll ─────────────────────────────────────────────────────── */}
            {activeSection === 'payroll' && (
              payrolls.length === 0
                ? <EmptyState label="No payroll drafts pending approval" />
                : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Employee</th><th>Period</th><th>Base Salary</th>
                          <th>Bonuses</th><th>Deductions</th><th>Net Pay</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrolls.map(p => {
                          const hue = ((p.profiles?.name ?? 'U').charCodeAt(0) * 13) % 360;
                          const net = Number(p.net_pay ?? 0);
                          const base = Number(p.base_salary ?? 0);
                          const deductions = Number(p.deductions ?? 0);
                          const bonuses = Number(p.bonuses ?? 0);
                          return (
                            <tr key={p.id}>
                              <td><AvCell name={p.profiles?.name ?? 'Employee'} hue={hue} /></td>
                              <td style={mono}>{p.period}</td>
                              <td>${base.toLocaleString()}</td>
                              <td style={{ color: bonuses > 0 ? 'var(--ok)' : 'var(--ink-3)' }}>
                                {bonuses > 0 ? `+$${bonuses.toLocaleString()}` : '—'}
                              </td>
                              <td style={{ color: 'var(--err)' }}>
                                {deductions > 0 ? `−$${deductions.toLocaleString()}` : '—'}
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--ok)', fontSize: 15 }}>
                                ${net.toLocaleString()}
                              </td>
                              <td>
                                <ActionBtns id={p.id} busy={busy}
                                  onApprove={() => handlePayrollAction(p.id, 'Approved', p.profiles?.name ?? 'Employee')}
                                  onReject={() => handlePayrollAction(p.id, 'Rejected', p.profiles?.name ?? 'Employee')}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
            )}

            {/* ─── Documents ───────────────────────────────────────────────────── */}
            {activeSection === 'documents' && (
              docs.length === 0
                ? <EmptyState label="No documents pending approval" />
                : (
                  <div style={{ padding: '0 18px 18px' }}>
                    {docs.map(doc => {
                      const hue = ((doc.profiles?.name ?? 'U').charCodeAt(0) * 13) % 360;
                      const typeHue = doc.type === 'Payslip' ? 145 : doc.type === 'Contract' ? 268 : doc.type === 'Report' ? 220 : 75;
                      const icon   = doc.type === 'Payslip' ? '💰' : doc.type === 'Contract' ? '📋' : doc.type === 'Report' ? '📊' : '📄';
                      const isExpanded = expandedDoc === doc.id;
                      return (
                        <div key={doc.id} style={{ marginBottom: 16, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                          {/* Document header row */}
                          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                              background: `oklch(0.93 0.05 ${typeHue})`, color: `oklch(0.38 0.14 ${typeHue})`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                            }}>
                              {icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                <span className="bdg" style={{ background: `oklch(0.93 0.05 ${typeHue})`, color: `oklch(0.38 0.14 ${typeHue})`, fontSize: 10 }}>
                                  {doc.type ?? 'Document'}
                                </span>
                                {doc.requires_signature && (
                                  <span className="bdg bdg-warn" style={{ fontSize: 10 }}>Requires Signature</span>
                                )}
                              </div>
                              <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {doc.title ?? doc.subject}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                                For: <strong style={{ color: 'var(--ink)' }}>{doc.profiles?.name ?? 'Unknown'}</strong>
                                {(doc.submitted_by_name || doc.sender) && (
                                  <>
                                    {' · Submitted by: '}
                                    <strong style={{ color: 'var(--ink)' }}>{doc.submitted_by_name ?? doc.sender}</strong>
                                  </>
                                )}
                                {doc.created_at && (
                                  <span style={{ marginLeft: 6, opacity: 0.7 }}>
                                    · {new Date(doc.created_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              {doc.content && (
                                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {doc.content}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                              {doc.html_content && (
                                <button
                                  className="btn btn-sec btn-sm"
                                  onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                                >
                                  {isExpanded ? '▲ Hide' : '▼ Preview'}
                                </button>
                              )}
                              <ActionBtns
                                id={doc.id}
                                busy={busy}
                                onApprove={() => handleDocAction(doc, 'approved')}
                                onReject={() => handleDocAction(doc, 'rejected')}
                              />
                            </div>
                          </div>

                          {/* Embedded document preview (iframe) */}
                          {isExpanded && doc.html_content && (
                            <div style={{ borderTop: '1px solid var(--line-2)', background: '#f8fafc' }}>
                              <iframe
                                srcDoc={doc.html_content}
                                style={{ width: '100%', minHeight: 420, border: 'none', display: 'block' }}
                                onLoad={e => {
                                  try {
                                    const h = (e.currentTarget as HTMLIFrameElement).contentDocument?.body?.scrollHeight;
                                    if (h) (e.currentTarget as HTMLIFrameElement).style.height = `${Math.min(h + 40, 1200)}px`;
                                  } catch {}
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
            )}
          </div>
        </div>

        {/* Decision log sidebar */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title" style={{ fontSize: 13 }}>Decision Log</div>
          </div>
          <div style={{ padding: '0 14px 14px' }}>
            {log.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--ink-4)', padding: '16px 0', textAlign: 'center' }}>Decisions appear here in real-time</div>
              : log.map((entry, i) => (
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
            }
          </div>
        </div>
      </div>
    </div>
  );
}
