'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

interface Props {
  profile: any;
  violations: any[];
  attendanceLogs: any[];
  target: any;
  salesLogs: any[];
  coachingSessions: any[];
}

export default function PerformanceClient({
  profile, violations, attendanceLogs, target, salesLogs, coachingSessions,
}: Props) {
  const [vList, setVList] = useState(violations);
  const [customDeductions, setCustomDeductions] = useState<{ label: string; amount: number }[]>([]);
  const [showDeductForm, setShowDeductForm] = useState(false);
  const [deductLabel, setDeductLabel] = useState('');
  const [deductAmt, setDeductAmt] = useState('');
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [coachDate, setCoachDate] = useState('');
  const [coachNotes, setCoachNotes] = useState('');
  const [coachSaving, setCoachSaving] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const points = typeof profile?.points === 'number' ? profile.points : 7;
  const salary = typeof profile?.salary === 'number' ? profile.salary : 2500;
  const autoDeductAmt = Math.max(0, (7 - points)) * 20;
  const customTotal = customDeductions.reduce((s, d) => s + d.amount, 0);
  const totalDeductions = autoDeductAmt + customTotal;
  const projectedNet = salary - totalDeductions;

  const pointsPct = (points / 7) * 100;
  const pointsColor = points >= 6 ? 'oklch(0.42 0.12 155)' : points >= 4 ? 'oklch(0.60 0.13 75)' : 'oklch(0.50 0.18 25)';
  const pointsRingColor = points >= 6 ? 'var(--ok)' : points >= 4 ? 'var(--warn)' : 'var(--err)';
  const unacknowledged = vList.filter(v => !v.acknowledged).length;

  const handleAcknowledge = async (id: string) => {
    await dbOp('violations', 'update', { acknowledged: true, acknowledged_at: new Date().toISOString() }, { id });
    setVList(prev => prev.map(v => v.id === id ? { ...v, acknowledged: true } : v));
  };

  const addCustomDeduction = () => {
    const amt = parseFloat(deductAmt);
    if (!deductLabel.trim() || isNaN(amt) || amt <= 0) return;
    setCustomDeductions(prev => [...prev, { label: deductLabel.trim(), amount: amt }]);
    setDeductLabel('');
    setDeductAmt('');
    setShowDeductForm(false);
  };

  const removeCustomDeduction = (i: number) => {
    setCustomDeductions(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleScheduleCoaching = async () => {
    if (!coachDate) return;
    setCoachSaving(true);
    await dbOp('inbox_documents', 'insert', {
      user_id: profile?.id,
      title: `Coaching Session Scheduled — ${new Date(coachDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      content: coachNotes || 'A coaching session has been scheduled for you. Please confirm attendance.',
      type: 'Notice',
      sender: 'Management',
      requires_signature: true,
    });
    setShowCoachModal(false);
    setCoachDate('');
    setCoachNotes('');
    setCoachSaving(false);
  };

  const handleSendReport = async () => {
    setReportSending(true);
    const body = [
      `Performance Report — ${profile?.name}`,
      `Role: ${profile?.role} | Department: ${profile?.department ?? 'N/A'}`,
      '',
      `Reliability Score: ${points}/7`,
      `Base Salary: $${salary.toLocaleString()}`,
      `Deductions: -$${totalDeductions}`,
      `Projected Net Pay: $${projectedNet.toLocaleString()}`,
      '',
      `Violations on record: ${vList.length}`,
      `Unacknowledged: ${unacknowledged}`,
    ].join('\n');

    await dbOp('inbox_documents', 'insert', {
      user_id: profile?.id,
      title: `Monthly Performance Report — ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      content: body,
      type: 'Report',
      sender: 'Management',
      requires_signature: false,
    });
    setReportSent(true);
    setShowReportModal(false);
    setReportSending(false);
  };

  // Attendance calendar
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const logsByDate: Record<string, any> = {};
  for (const log of attendanceLogs) {
    if (log.date) logsByDate[log.date] = log;
  }
  const mPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const totalPresent = attendanceLogs.filter(l => l.status === 'present' && l.date?.startsWith(mPrefix)).length;
  const totalLate    = attendanceLogs.filter(l => l.status === 'late'    && l.date?.startsWith(mPrefix)).length;
  const totalAbsent  = attendanceLogs.filter(l => l.status === 'absent'  && l.date?.startsWith(mPrefix)).length;

  // Target
  const isSalesOrCx = ['sales', 'cx'].includes(profile?.role ?? '');
  const monthStart = new Date(year, month, 1);
  const monthSales = salesLogs.filter(s => s.created_at && new Date(s.created_at) >= monthStart);
  const totalRevenue = monthSales.reduce((sum, s) => sum + (s.amount || 0), 0);
  const salesCount = monthSales.length;
  const revenueTarget = target?.revenue_target ?? 0;
  const countTarget = target?.sales_count_target ?? 0;
  const revenuePct = revenueTarget > 0 ? Math.min(100, (totalRevenue / revenueTarget) * 100) : 0;
  const countPct = countTarget > 0 ? Math.min(100, (salesCount / countTarget) * 100) : 0;
  const daysPassed = now.getDate();
  const daysLeft = daysInMonth - daysPassed;
  const pace = revenueTarget > 0 ? totalRevenue / daysPassed : 0;
  const projectedRevenue = pace * daysInMonth;
  const paceLabel = projectedRevenue >= revenueTarget * 0.95 ? 'On track' : projectedRevenue >= revenueTarget * 0.75 ? 'Slightly behind' : 'Behind pace';
  const paceColor = paceLabel === 'On track' ? 'var(--ok)' : paceLabel === 'Slightly behind' ? 'var(--warn)' : 'var(--err)';

  // SVG ring
  const r = 44, circ = 2 * Math.PI * r;
  const offset = circ - (pointsPct / 100) * circ;

  return (
    <div className="page-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em' }}>My Performance</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>
            {profile?.name} · {profile?.role} · {profile?.department ?? 'No department'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sec btn-sm" onClick={() => setShowCoachModal(true)}>Schedule Coaching</button>
          <button className={`btn btn-sm ${reportSent ? 'btn-sec' : 'btn-acc'}`} onClick={() => setShowReportModal(true)}>
            {reportSent ? '✓ Report Sent' : 'Send Report'}
          </button>
        </div>
      </div>

      {/* Row 1: Score + Payslip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Reliability ring */}
        <div className="card card-body" style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 20 }}>
          <div style={{ width: 100, height: 100, flexShrink: 0, position: 'relative' }}>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
              <circle cx="50" cy="50" r={r} fill="none" stroke={pointsRingColor} strokeWidth="8"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: pointsColor, lineHeight: 1 }}>{points}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>/ 7 pts</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Reliability Score</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              {points >= 6 ? 'Excellent — keep it up.' : points >= 4 ? 'Fair — watch for violations.' : 'Low — at risk of salary deductions.'}
            </div>
            {unacknowledged > 0 && (
              <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--warn-soft)', color: 'oklch(0.45 0.12 75)', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600 }}>
                ⚠ {unacknowledged} unread violation{unacknowledged !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Projected Payslip */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Projected Payslip</div>
            <button className="btn btn-sec btn-sm" onClick={() => setShowDeductForm(s => !s)} style={{ fontSize: 11 }}>
              {showDeductForm ? '× Cancel' : '+ Add Deduction'}
            </button>
          </div>

          {showDeductForm && (
            <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="fld-input"
                placeholder="Deduction label…"
                value={deductLabel}
                onChange={e => setDeductLabel(e.target.value)}
                style={{ flex: 1, minWidth: 120 }}
              />
              <input
                className="fld-input"
                type="number"
                placeholder="Amount ($)"
                value={deductAmt}
                onChange={e => setDeductAmt(e.target.value)}
                style={{ width: 100 }}
              />
              <button className="btn btn-acc btn-sm" onClick={addCustomDeduction}>Add</button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--ink-3)' }}>Base Salary</span>
              <span style={{ fontWeight: 600 }}>${salary.toLocaleString()}</span>
            </div>
            {autoDeductAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'oklch(0.45 0.16 25)' }}>Point deductions ({7 - points} pts × $20)</span>
                <span style={{ fontWeight: 600, color: 'oklch(0.45 0.16 25)' }}>−${autoDeductAmt}</span>
              </div>
            )}
            {customDeductions.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, alignItems: 'center' }}>
                <span style={{ color: 'oklch(0.45 0.16 25)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {d.label}
                  <button onClick={() => removeCustomDeduction(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--ink-4)', padding: 0 }}>✕</button>
                </span>
                <span style={{ fontWeight: 600, color: 'oklch(0.45 0.16 25)' }}>−${d.amount}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ fontWeight: 600 }}>Projected Net Pay</span>
              <span style={{ fontWeight: 700, color: totalDeductions > 0 ? 'oklch(0.45 0.16 25)' : 'var(--ok)' }}>
                ${projectedNet.toLocaleString()}
              </span>
            </div>
          </div>

          {totalDeductions === 0 && (
            <div style={{ marginTop: 10, fontSize: 11.5, color: 'oklch(0.42 0.12 155)', background: 'var(--ok-soft)', padding: '6px 10px', borderRadius: 6 }}>
              ✓ No deductions — full salary this month.
            </div>
          )}
          {customDeductions.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
              Salary impact: −${customTotal} custom + −${autoDeductAmt} auto = −${totalDeductions} total
            </div>
          )}
        </div>
      </div>

      {/* Violations Log */}
      <div className="card" style={{ marginBottom: 14, overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Violations Log</div>
            <div className="card-sub">All policy violations applied to your account</div>
          </div>
          {unacknowledged > 0 && <span className="bdg bdg-warn">{unacknowledged} New</span>}
        </div>

        {vList.length === 0 ? (
          <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--ink-4)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
            <div style={{ fontWeight: 600 }}>No violations on record.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Keep it up — perfect reliability.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Rule & Explanation</th>
                  <th style={{ textAlign: 'right' }}>Points</th>
                  <th style={{ textAlign: 'right' }}>Salary Impact</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {vList.map(v => (
                  <tr key={v.id} style={{ background: v.acknowledged ? 'transparent' : 'var(--warn-soft)' }}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                      {new Date(v.triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>{v.rule_name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>{v.explanation}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: v.points_deducted > 0 ? 'oklch(0.45 0.16 25)' : 'var(--ink-3)' }}>
                      {v.points_deducted > 0 ? `−${v.points_deducted} pts` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: v.salary_deducted > 0 ? 'oklch(0.45 0.16 25)' : 'var(--ink-4)' }}>
                      {v.salary_deducted > 0 ? `−$${v.salary_deducted}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {v.acknowledged ? (
                        <span className="bdg bdg-ok" style={{ fontSize: 10 }}>Acknowledged</span>
                      ) : (
                        <button className="btn btn-sec btn-sm" style={{ fontSize: 10.5 }} onClick={() => handleAcknowledge(v.id)}>
                          Acknowledge
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attendance Calendar */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Attendance — {now.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--ink-3)' }}>
            <span>✓ Present: <strong style={{ color: 'var(--ok)' }}>{totalPresent}</strong></span>
            <span>L Late: <strong style={{ color: 'var(--warn)' }}>{totalLate}</strong></span>
            <span>✕ Absent: <strong style={{ color: 'var(--err)' }}>{totalAbsent}</strong></span>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--ink-4)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${mPrefix}-${String(day).padStart(2, '0')}`;
              const log = logsByDate[dateStr];
              const isToday = day === now.getDate();
              const isFuture = day > now.getDate();
              let bg = 'var(--surface-3)', color = 'var(--ink-4)', label = '';
              if (!isFuture && log) {
                if (log.status === 'present') { bg = 'oklch(0.9 0.06 155)'; color = 'oklch(0.38 0.12 155)'; label = '·'; }
                else if (log.status === 'late') { bg = 'var(--warn-soft)'; color = 'oklch(0.45 0.12 75)'; label = 'L'; }
                else if (log.status === 'absent') { bg = 'var(--err-soft)'; color = 'oklch(0.45 0.16 25)'; label = '✕'; }
              }
              return (
                <div key={dateStr} title={log ? `${dateStr}: ${log.status}` : dateStr} style={{ aspectRatio: '1', borderRadius: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: bg, color, fontSize: 10, fontWeight: 600, outline: isToday ? '2px solid var(--accent)' : 'none', outlineOffset: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: isToday ? 700 : 500 }}>{day}</div>
                  {label && <div style={{ fontSize: 8, lineHeight: 1 }}>{label}</div>}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: 'var(--ink-4)' }}>
            {[['oklch(0.9 0.06 155)', 'Present'], ['var(--warn-soft)', 'Late'], ['var(--err-soft)', 'Absent'], ['var(--surface-3)', 'No record']].map(([bg, lbl]) => (
              <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, display: 'inline-block' }} />
                {lbl}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Target Progress */}
      {isSalesOrCx && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-hdr">
            <div className="card-title">Target Progress — {now.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
            <span style={{ fontSize: 12, color: paceColor, fontWeight: 600 }}>{paceLabel} · {daysLeft} days left</span>
          </div>
          <div className="card-body">
            {!target ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No target set. Ask your manager to set one.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="hb-row">
                  <div className="hb-head"><span className="lbl">Revenue</span><span className="v">${totalRevenue.toLocaleString()} / ${revenueTarget.toLocaleString()}</span></div>
                  <div className="hb"><div className="hb-f" style={{ width: `${revenuePct}%`, background: revenuePct >= 100 ? 'var(--ok)' : revenuePct >= 70 ? 'var(--accent)' : 'var(--warn)' }} /></div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 4, fontFamily: 'var(--mono)' }}>{revenuePct.toFixed(0)}% complete</div>
                </div>
                <div className="hb-row">
                  <div className="hb-head"><span className="lbl">Sales Count</span><span className="v">{salesCount} / {countTarget}</span></div>
                  <div className="hb"><div className="hb-f" style={{ width: `${countPct}%`, background: countPct >= 100 ? 'var(--ok)' : countPct >= 70 ? 'var(--accent)' : 'var(--warn)' }} /></div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 4, fontFamily: 'var(--mono)' }}>{countPct.toFixed(0)}% complete</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Coaching Sessions */}
      {coachingSessions.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-hdr">
            <div className="card-title">Recent Coaching Sessions</div>
            <button className="btn btn-sec btn-sm" onClick={() => setShowCoachModal(true)}>+ Schedule Session</button>
          </div>
          <div className="card-body">
            {coachingSessions.map((s: any) => (
              <div key={s.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.type} Session</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
                    {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                {s.notes && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 6, lineHeight: 1.55 }}>{s.notes}</div>}
                {s.action_plan && (
                  <div style={{ background: 'var(--accent-soft)', padding: '8px 10px', borderRadius: 6, fontSize: 12, color: 'var(--accent-ink)', marginBottom: 6 }}>
                    <strong>Action Plan:</strong> {s.action_plan}
                  </div>
                )}
                {s.next_review && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
                    Next review: {new Date(s.next_review).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule Coaching Modal */}
      {showCoachModal && (
        <div className="mb">
          <div className="md" style={{ width: 420 }}>
            <div className="md-t">Schedule Coaching Session</div>
            <div className="pv-fld">
              <label>Session Date</label>
              <input type="date" value={coachDate} onChange={e => setCoachDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="pv-fld">
              <label>Notes (optional)</label>
              <textarea rows={4} value={coachNotes} onChange={e => setCoachNotes(e.target.value)} placeholder="Topics to cover, context for the session…" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-acc" onClick={handleScheduleCoaching} disabled={!coachDate || coachSaving}>
                {coachSaving ? 'Scheduling…' : 'Schedule & Notify Employee'}
              </button>
              <button className="btn btn-sec" onClick={() => setShowCoachModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Send Report Modal */}
      {showReportModal && (
        <div className="mb">
          <div className="md" style={{ width: 400 }}>
            <div className="md-t">Send Performance Report</div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>
              This will send a performance summary report to <strong>{profile?.name}</strong>'s inbox, including their reliability score, projected payslip, and violation count.
            </p>
            <div style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginBottom: 20 }}>
              Score: {points}/7 · Net: ${projectedNet.toLocaleString()} · Violations: {vList.length}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-acc" onClick={handleSendReport} disabled={reportSending}>
                {reportSending ? 'Sending…' : 'Send to Inbox'}
              </button>
              <button className="btn btn-sec" onClick={() => setShowReportModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
