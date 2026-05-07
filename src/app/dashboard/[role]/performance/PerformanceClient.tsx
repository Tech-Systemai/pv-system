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
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [coachDate, setCoachDate] = useState('');
  const [coachNotes, setCoachNotes] = useState('');
  const [coachSaving, setCoachSaving] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const points = typeof profile?.points === 'number' ? profile.points : 7;
  const salary = typeof profile?.salary === 'number' ? profile.salary : 2500;
  // Sum actual salary_deducted from violations — no fallback formula
  const deduction = vList.reduce((s: number, v: any) => s + (v.salary_deducted ?? 0), 0);
  const netPay = salary - deduction;
  const unacknowledged = vList.filter((v: any) => !v.acknowledged).length;

  const scoreColor = points >= 6 ? 'var(--ok)' : points >= 4 ? 'var(--warn)' : 'var(--err)';
  const scoreLabel = points >= 6 ? 'Excellent' : points >= 4 ? 'Watch list' : 'Action needed';

  // SVG ring math
  const r = 48, c = 2 * Math.PI * r;
  const scorePct = (points / 7) * 100;
  const offset = c - (scorePct / 100) * c;

  const handleAcknowledge = async (id: string) => {
    await dbOp('violations', 'update', { acknowledged: true, acknowledged_at: new Date().toISOString() }, { id });
    setVList((prev: any[]) => prev.map((v: any) => v.id === id ? { ...v, acknowledged: true } : v));
  };

  const handleScheduleCoaching = async () => {
    if (!coachDate) return;
    setCoachSaving(true);
    await dbOp('inbox_documents', 'insert', {
      user_id: profile?.id,
      title: `Coaching Session Scheduled — ${new Date(coachDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      subject: `Coaching Session Scheduled — ${new Date(coachDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      content: coachNotes || 'A coaching session has been scheduled for you. Please confirm attendance.',
      type: 'Notice', sender: 'Management', requires_signature: true,
    });
    setShowCoachModal(false); setCoachDate(''); setCoachNotes('');
    setCoachSaving(false);
  };

  const handleSendReport = async () => {
    setReportSending(true);
    await dbOp('inbox_documents', 'insert', {
      user_id: profile?.id,
      title: `Monthly Performance Report — ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      subject: `Monthly Performance Report — ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      content: [
        `Performance Report — ${profile?.name}`,
        `Role: ${profile?.role}`, '',
        `Reliability Score: ${points}/7`,
        `Base Salary: $${salary.toLocaleString()}`,
        `Deductions: -$${deduction}`,
        `Projected Net Pay: $${netPay.toLocaleString()}`, '',
        `Violations: ${vList.length}`,
        `Unacknowledged: ${unacknowledged}`,
      ].join('\n'),
      type: 'Report', sender: 'Management', requires_signature: false,
    });
    setReportSent(true); setShowReportModal(false); setReportSending(false);
  };

  // Attendance calendar
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const mPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const logsByDate: Record<string, any> = {};
  for (const log of attendanceLogs) {
    if (log.date) logsByDate[log.date] = log;
  }
  const totalPresent = attendanceLogs.filter((l: any) => l.status === 'present' && l.date?.startsWith(mPrefix)).length;
  const totalLate    = attendanceLogs.filter((l: any) => l.status === 'late'    && l.date?.startsWith(mPrefix)).length;
  const totalAbsent  = attendanceLogs.filter((l: any) => l.status === 'absent'  && l.date?.startsWith(mPrefix)).length;

  // Target
  const isSalesOrCx = ['sales', 'cx'].includes(profile?.role ?? '');
  const monthStart = new Date(year, month, 1);
  const monthSales = salesLogs.filter((s: any) => s.created_at && new Date(s.created_at) >= monthStart);
  const totalRevenue = monthSales.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
  const salesCount = monthSales.length;
  const revenueTarget = target?.revenue_target ?? 0;
  const countTarget = target?.sales_count_target ?? 0;
  const revenuePct = revenueTarget > 0 ? Math.min(100, (totalRevenue / revenueTarget) * 100) : 0;
  const countPct = countTarget > 0 ? Math.min(100, (salesCount / countTarget) * 100) : 0;
  const daysPassed = now.getDate();
  const pace = revenueTarget > 0 && daysPassed > 0 ? totalRevenue / daysPassed : 0;
  const projectedRevenue = pace * daysInMonth;
  const paceLabel = projectedRevenue >= revenueTarget * 0.95 ? 'On track' : projectedRevenue >= revenueTarget * 0.75 ? 'Slightly behind' : 'Behind pace';
  const paceColor = paceLabel === 'On track' ? 'var(--ok)' : paceLabel === 'Slightly behind' ? 'var(--warn)' : 'var(--err)';
  const monthName = now.toLocaleString('default', { month: 'long' });

  return (
    <div className="page-fade">
      {/* 3-column top row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>

        {/* Score ring */}
        <div className="card" style={{ padding: 22, display: 'flex', gap: 18, alignItems: 'center' }}>
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
            <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
            <circle cx="60" cy="60" r={r} fill="none" stroke={scoreColor} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset .6s var(--ease)' }} />
            <text x="60" y="58" textAnchor="middle" fontSize="28" fontWeight="600" fill="var(--ink)" fontFamily="var(--mono)">{points.toFixed(1)}</text>
            <text x="60" y="76" textAnchor="middle" fontSize="11" fill="var(--ink-3)" fontFamily="var(--mono)">/ 7.0</text>
          </svg>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Reliability score
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 4 }}>{scoreLabel}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              Based on {vList.length} violation{vList.length !== 1 ? 's' : ''} across attendance and productivity.
            </div>
            {unacknowledged > 0 && (
              <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--warn-soft)', color: 'oklch(0.45 0.12 75)', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
                ⚠ {unacknowledged} unread
              </div>
            )}
          </div>
        </div>

        {/* Projected payslip */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Projected payslip · {monthName}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Base salary</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>${salary.toLocaleString()}</span>
          </div>
          {deduction > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
              <span style={{ fontSize: 13, color: 'var(--err)' }}>Deductions ({vList.length})</span>
              <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--err)' }}>− ${deduction}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 4px' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Net (projected)</span>
            <span className="mono" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em' }}>${netPay.toLocaleString()}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 6 }}>Live calc · payroll runs end of month</div>
        </div>

        {/* Target progress */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Target progress
          </div>
          {!isSalesOrCx || !target ? (
            <div style={{ fontSize: 12, color: 'var(--ink-4)', paddingTop: 10 }}>
              {isSalesOrCx ? 'No target set. Ask your manager.' : 'Targets apply to Sales & CX roles.'}
            </div>
          ) : (
            <>
              {[
                [`Revenue · ${monthName}`, `$${(totalRevenue / 1000).toFixed(0)}k`, `$${(revenueTarget / 1000).toFixed(0)}k`, revenuePct, paceLabel],
                ['Sales count', String(salesCount), String(countTarget), countPct, paceLabel],
              ].map(([l, curr, tgt, pct, pace], i) => (
                <div key={i} style={{ marginBottom: i === 0 ? 14 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ fontWeight: 500 }}>{l}</span>
                    <span className="mono" style={{ color: 'var(--ink-3)' }}>{curr} / {tgt}</span>
                  </div>
                  <div className="hb">
                    <div className="hb-f ok" style={{ width: `${pct}%` }} />
                  </div>
                  <div style={{ fontSize: 11, color: paceColor, marginTop: 4, fontFamily: 'var(--mono)' }}>
                    ● {pace}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Violations log — inline rows */}
      <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Violations log</div>
            <div className="card-sub">
              {unacknowledged} unacknowledged · acknowledge to clear from your queue
            </div>
          </div>
          {unacknowledged > 0 && <span className="bdg bdg-warn">{unacknowledged} New</span>}
        </div>
        <div style={{ padding: '0 12px 12px' }}>
          {vList.length === 0 ? (
            <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-4)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              <div style={{ fontWeight: 600 }}>No violations on record.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Keep it up — perfect reliability.</div>
            </div>
          ) : (
            vList.map((v: any) => (
              <div key={v.id} style={{
                display: 'grid', gridTemplateColumns: '80px 140px 1fr 80px 80px 120px', gap: 14, alignItems: 'center',
                padding: '14px 12px', marginBottom: 6, borderRadius: 9,
                background: v.acknowledged ? 'var(--surface-2)' : 'var(--warn-soft)',
                border: v.acknowledged ? '1px solid var(--line-2)' : '1px solid oklch(0.85 0.08 75)',
                opacity: v.acknowledged ? 0.7 : 1,
              }}>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                  {new Date(v.triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{v.rule_name}</span>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{v.explanation}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--err)', textAlign: 'right' }}>
                  {v.points_deducted ? `− ${v.points_deducted} pts` : '—'}
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--err)', textAlign: 'right' }}>
                  {v.salary_deducted ? `− $${v.salary_deducted}` : '—'}
                </span>
                {v.acknowledged
                  ? <span className="bdg bdg-ok" style={{ justifyContent: 'center' }}>✓ Acknowledged</span>
                  : <button className="btn btn-sec btn-sm" onClick={() => handleAcknowledge(v.id)}>Acknowledge</button>
                }
              </div>
            ))
          )}
        </div>
      </div>

      {/* two-col: Attendance + Coaching */}
      <div className="two-col">
        {/* Attendance calendar */}
        <div className="card">
          <div className="card-hdr">
            <div>
              <div className="card-title">Attendance · {monthName}</div>
              <div className="card-sub">Personal attendance log</div>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--ink-3)' }}>
              <span style={{ color: 'var(--ok)' }}>✓ {totalPresent}</span>
              <span style={{ color: 'var(--warn)' }}>L {totalLate}</span>
              <span style={{ color: 'var(--err)' }}>✕ {totalAbsent}</span>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--ink-3)', padding: '4px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {/* offset for first day — Mon-based, firstDow is Sun=0 */}
              {Array.from({ length: (firstDow + 6) % 7 }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${mPrefix}-${String(day).padStart(2, '0')}`;
                const log = logsByDate[dateStr];
                const isToday = day === now.getDate();
                const isFuture = day > now.getDate();
                let bg = 'var(--surface-3)', color = 'var(--ink-4)';
                if (!isFuture && log) {
                  if (log.status === 'present') { bg = 'var(--ok-soft)'; color = 'oklch(0.42 0.12 155)'; }
                  else if (log.status === 'late') { bg = 'var(--warn-soft)'; color = 'oklch(0.45 0.12 75)'; }
                  else if (log.status === 'absent') { bg = 'var(--err-soft)'; color = 'oklch(0.45 0.16 25)'; }
                }
                return (
                  <div key={dateStr} style={{
                    aspectRatio: '1', borderRadius: 6, background: bg, color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 500,
                    outline: isToday ? '2px solid var(--accent)' : 'none', outlineOffset: 1,
                  }}>{day}</div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-2)', fontSize: 11 }}>
              {[['var(--ok)', 'Present'], ['var(--warn)', 'Late'], ['var(--err)', 'Absent']].map(([dot, label]) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink-3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block' }} />{label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Coaching sessions */}
        <div className="card">
          <div className="card-hdr">
            <div>
              <div className="card-title">Recent coaching</div>
              <div className="card-sub">Last {Math.min(3, coachingSessions.length)} sessions</div>
            </div>
            <button className="btn btn-sec btn-sm" onClick={() => setShowCoachModal(true)}>+ Schedule</button>
          </div>
          <div className="card-body">
            {coachingSessions.length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>
                No coaching sessions on record.
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-sec btn-sm" onClick={() => setShowCoachModal(true)}>Request a session</button>
                </div>
              </div>
            ) : (
              coachingSessions.slice(0, 3).map((s: any, i: number) => (
                <div key={s.id} style={{ padding: '12px 0', borderBottom: i < Math.min(2, coachingSessions.length - 1) ? '1px solid var(--line-2)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.type ?? 'Coaching'} Session</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                      {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {s.coach_name ? ` · w/ ${s.coach_name}` : ''}
                    </span>
                  </div>
                  {s.notes && <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 4 }}>{s.notes}</div>}
                  {s.action_plan && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4, lineHeight: 1.5 }}>{s.action_plan}</div>}
                  {s.next_review && (
                    <span className="bdg bdg-acc">
                      Next review · {new Date(s.next_review).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Schedule Coaching Modal */}
      {showCoachModal && (
        <div className="mb" onClick={e => { if (e.target === e.currentTarget) setShowCoachModal(false); }}>
          <div className="md" style={{ width: 420 }}>
            <div className="md-t">Schedule Coaching Session</div>
            <div className="pv-fld">
              <label>Session Date</label>
              <input type="date" value={coachDate} onChange={e => setCoachDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} className="fld-input" />
            </div>
            <div className="pv-fld">
              <label>Notes (optional)</label>
              <textarea rows={4} value={coachNotes} onChange={e => setCoachNotes(e.target.value)}
                className="fld-input"
                placeholder="Topics to cover, context for the session…" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-acc" onClick={handleScheduleCoaching} disabled={!coachDate || coachSaving}>
                {coachSaving ? 'Scheduling…' : 'Schedule & Notify'}
              </button>
              <button className="btn btn-sec" onClick={() => setShowCoachModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Send Report Modal */}
      {showReportModal && (
        <div className="mb" onClick={e => { if (e.target === e.currentTarget) setShowReportModal(false); }}>
          <div className="md" style={{ width: 400 }}>
            <div className="md-t">Send Performance Report</div>
            <div style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginBottom: 16 }}>
              Score: {points.toFixed(1)}/7 · Net: ${netPay.toLocaleString()} · Violations: {vList.length}
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>
              This will send a performance summary to <strong>{profile?.name}</strong>'s inbox including their reliability score, projected payslip, and violation count.
            </p>
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
