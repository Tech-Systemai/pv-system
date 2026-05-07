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
  profile,
  violations,
  attendanceLogs,
  target,
  salesLogs,
  coachingSessions,
}: Props) {
  const [vList, setVList] = useState(violations);

  const points = typeof profile?.points === 'number' ? profile.points : 7;
  const salary = typeof profile?.salary === 'number' ? profile.salary : 2500;
  const deductionAmt = Math.max(0, (7 - points)) * 20;
  const projectedNet = salary - deductionAmt;

  const pointsPct = (points / 7) * 100;
  const pointsColor =
    points >= 6 ? 'oklch(0.42 0.12 155)' :
    points >= 4 ? 'oklch(0.60 0.13 75)' :
    'oklch(0.50 0.18 25)';
  const pointsRingColor =
    points >= 6 ? 'var(--ok)' :
    points >= 4 ? 'var(--warn)' :
    'var(--err)';

  const unacknowledged = vList.filter(v => !v.acknowledged).length;

  const handleAcknowledge = async (id: string) => {
    await dbOp('violations', 'update', { acknowledged: true, acknowledged_at: new Date().toISOString() }, { id });
    setVList(prev => prev.map(v => v.id === id ? { ...v, acknowledged: true } : v));
  };

  // ── Attendance calendar (current month) ────────────────────
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun

  const logsByDate: Record<string, any> = {};
  for (const log of attendanceLogs) {
    if (log.date) logsByDate[log.date] = log;
  }

  const totalPresent = attendanceLogs.filter(l => l.status === 'present' && l.date?.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;
  const totalLate = attendanceLogs.filter(l => l.status === 'late' && l.date?.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;
  const totalAbsent = attendanceLogs.filter(l => l.status === 'absent' && l.date?.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;

  // ── Target progress (sales/cx) ──────────────────────────────
  const isSalesOrCx = ['sales', 'cx'].includes(profile?.role ?? '');
  const monthStart = new Date(year, month, 1);
  const monthSales = salesLogs.filter(s => s.created_at && new Date(s.created_at) >= monthStart);
  const totalRevenue = monthSales.reduce((sum, s) => sum + (s.amount || 0), 0);
  const salesCount = monthSales.length;
  const revenueTarget = target?.revenue_target ?? 0;
  const countTarget = target?.sales_count_target ?? 0;
  const revenuePct = revenueTarget > 0 ? Math.min(100, (totalRevenue / revenueTarget) * 100) : 0;
  const countPct = countTarget > 0 ? Math.min(100, (salesCount / countTarget) * 100) : 0;
  const daysInMonthTotal = daysInMonth;
  const daysPassed = now.getDate();
  const daysLeft = daysInMonthTotal - daysPassed;
  const pace = revenueTarget > 0 ? totalRevenue / daysPassed : 0;
  const projectedRevenue = pace * daysInMonthTotal;
  const paceLabel =
    projectedRevenue >= revenueTarget * 0.95 ? 'On track' :
    projectedRevenue >= revenueTarget * 0.75 ? 'Slightly behind' :
    'Behind pace';
  const paceColor =
    paceLabel === 'On track' ? 'var(--ok)' :
    paceLabel === 'Slightly behind' ? 'var(--warn)' :
    'var(--err)';

  // ── SVG ring helper ─────────────────────────────────────────
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pointsPct / 100) * circ;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.015em' }}>My Performance</div>
        <div style={{ fontSize: '13px', color: 'var(--ink-3)', marginTop: '3px' }}>
          {profile?.name} · {profile?.role} · {profile?.department ?? 'No department'}
        </div>
      </div>

      {/* ── Row 1: Score + Deduction Breakdown ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        {/* Reliability Score */}
        <div className="pn" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div className="circ" style={{ width: '100px', height: '100px', flexShrink: 0 }}>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r={r} fill="none"
                stroke={pointsRingColor} strokeWidth="8"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="circ-tx">
              <div className="circ-v" style={{ color: pointsColor }}>{points}</div>
              <div className="circ-l">/ 7 pts</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>Reliability Score</div>
            <div style={{ fontSize: '12px', color: 'var(--ink-3)', lineHeight: 1.6 }}>
              {points >= 6 ? 'Excellent — keep it up.' : points >= 4 ? 'Fair — watch for violations.' : 'Low — at risk of salary deductions.'}
            </div>
            {unacknowledged > 0 && (
              <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--warn-soft)', color: 'oklch(0.45 0.12 75)', borderRadius: '6px', padding: '4px 10px', fontSize: '11.5px', fontWeight: 600 }}>
                ⚠ {unacknowledged} unread violation{unacknowledged !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Deduction Breakdown */}
        <div className="pn">
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '14px' }}>Projected Payslip (This Month)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--ink-3)' }}>Base Salary</span>
              <span style={{ fontWeight: 600 }}>${salary.toLocaleString()}</span>
            </div>
            {deductionAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'oklch(0.45 0.16 25)' }}>Deductions ({7 - points} pts × $20)</span>
                <span style={{ fontWeight: 600, color: 'oklch(0.45 0.16 25)' }}>−${deductionAmt}</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ fontWeight: 600 }}>Projected Net Pay</span>
              <span style={{ fontWeight: 700, color: deductionAmt > 0 ? 'oklch(0.45 0.16 25)' : 'var(--ok)' }}>
                ${projectedNet.toLocaleString()}
              </span>
            </div>
          </div>
          {deductionAmt === 0 && (
            <div style={{ marginTop: '10px', fontSize: '11.5px', color: 'oklch(0.42 0.12 155)', background: 'var(--ok-soft)', padding: '6px 10px', borderRadius: '6px' }}>
              ✓ No deductions — full salary this month.
            </div>
          )}
        </div>
      </div>

      {/* ── Violations Log ──────────────────────────────────── */}
      <div className="pn" style={{ marginBottom: '14px' }}>
        <div className="pn-h" style={{ marginBottom: '14px' }}>
          <div>
            <div className="pn-t">Violations Log</div>
            <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', marginTop: '2px' }}>All policy violations applied to your account</div>
          </div>
          {unacknowledged > 0 && (
            <span className="pv-bdg pv-bdg-amber">{unacknowledged} New</span>
          )}
        </div>

        {vList.length === 0 ? (
          <div className="empty" style={{ padding: '28px' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>✓</div>
            <div style={{ fontWeight: 600 }}>No violations on record.</div>
            <div style={{ fontSize: '12px', color: 'var(--ink-4)', marginTop: '4px' }}>Keep it up — perfect reliability.</div>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 80px 90px 100px', gap: '8px', padding: '7px 12px', background: 'var(--surface-3)', borderRadius: '7px', marginBottom: '6px', fontSize: '10.5px', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--mono)' }}>
              <div>Date</div>
              <div>Rule &amp; Explanation</div>
              <div style={{ textAlign: 'right' }}>Points</div>
              <div style={{ textAlign: 'right' }}>Salary Impact</div>
              <div style={{ textAlign: 'right' }}>Status</div>
            </div>
            {vList.map(v => (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 80px 90px 100px', gap: '8px', padding: '11px 12px', borderBottom: '1px solid var(--line-2)', alignItems: 'start', background: v.acknowledged ? 'transparent' : 'var(--warn-soft)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)', paddingTop: '2px' }}>
                  {new Date(v.triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', marginBottom: '3px' }}>{v.rule_name}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', lineHeight: 1.55 }}>{v.explanation}</div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 700, color: v.points_deducted > 0 ? 'oklch(0.45 0.16 25)' : 'var(--ink-3)', paddingTop: '2px' }}>
                  {v.points_deducted > 0 ? `−${v.points_deducted} pts` : '—'}
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '12px', color: v.salary_deducted > 0 ? 'oklch(0.45 0.16 25)' : 'var(--ink-4)', paddingTop: '2px' }}>
                  {v.salary_deducted > 0 ? `−$${v.salary_deducted}` : '—'}
                </div>
                <div style={{ textAlign: 'right', paddingTop: '1px' }}>
                  {v.acknowledged ? (
                    <span className="pv-bdg pv-bdg-green" style={{ fontSize: '10px' }}>Acknowledged</span>
                  ) : (
                    <button
                      className="pv-btn pv-btn-sec"
                      style={{ fontSize: '10.5px', padding: '4px 8px' }}
                      onClick={() => handleAcknowledge(v.id)}
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Attendance Calendar ─────────────────────────────── */}
      <div className="pn" style={{ marginBottom: '14px' }}>
        <div className="pn-h" style={{ marginBottom: '14px' }}>
          <div className="pn-t">
            Attendance — {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '11.5px', color: 'var(--ink-3)' }}>
            <span>✓ Present: <strong style={{ color: 'var(--ok)' }}>{totalPresent}</strong></span>
            <span>L Late: <strong style={{ color: 'var(--warn)' }}>{totalLate}</strong></span>
            <span>✕ Absent: <strong style={{ color: 'var(--err)' }}>{totalAbsent}</strong></span>
          </div>
        </div>

        {/* Day-of-week headers */}
        <div className="att-grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 700, color: 'var(--ink-4)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 0' }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
          {/* Empty cells for first week offset */}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`e-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const log = logsByDate[dateStr];
            const isToday = day === now.getDate();
            const isFuture = day > now.getDate();
            let bg = 'var(--surface-3)';
            let color = 'var(--ink-4)';
            let label = '';
            if (!isFuture && log) {
              if (log.status === 'present') { bg = 'oklch(0.9 0.06 155)'; color = 'oklch(0.38 0.12 155)'; label = '·'; }
              else if (log.status === 'late') { bg = 'var(--warn-soft)'; color = 'oklch(0.45 0.12 75)'; label = 'L'; }
              else if (log.status === 'absent') { bg = 'var(--err-soft)'; color = 'oklch(0.45 0.16 25)'; label = '✕'; }
            }
            return (
              <div
                key={dateStr}
                title={log ? `${dateStr}: ${log.status}${log.productive_time_minutes ? ` | ${Math.floor(log.productive_time_minutes / 60)}h ${log.productive_time_minutes % 60}m tracked` : ''}` : dateStr}
                style={{
                  aspectRatio: '1', borderRadius: '5px', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', background: bg, color,
                  fontSize: '10px', fontWeight: 600, cursor: 'default',
                  outline: isToday ? '2px solid var(--accent)' : 'none',
                  outlineOffset: '1px',
                }}
              >
                <div style={{ fontSize: '9px', color: isToday ? 'var(--accent-ink)' : color, fontWeight: isToday ? 700 : 500 }}>{day}</div>
                {label && <div style={{ fontSize: '8px', lineHeight: 1 }}>{label}</div>}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '11px', color: 'var(--ink-4)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'oklch(0.9 0.06 155)', display: 'inline-block' }} /> Present</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--warn-soft)', display: 'inline-block' }} /> Late</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--err-soft)', display: 'inline-block' }} /> Absent</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--surface-3)', display: 'inline-block' }} /> No record</span>
        </div>
      </div>

      {/* ── Target Progress (Sales / CX only) ───────────────── */}
      {isSalesOrCx && (
        <div className="pn" style={{ marginBottom: '14px' }}>
          <div className="pn-h" style={{ marginBottom: '16px' }}>
            <div className="pn-t">Target Progress — {now.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
            <span style={{ fontSize: '12px', color: paceColor, fontWeight: 600 }}>{paceLabel} · {daysLeft} days left</span>
          </div>

          {!target ? (
            <div className="empty" style={{ padding: '16px' }}>No target set for this period. Ask your manager to set one.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="hb-row">
                <div className="hb-head">
                  <span className="lbl">Revenue</span>
                  <span className="v">${totalRevenue.toLocaleString()} / ${revenueTarget.toLocaleString()}</span>
                </div>
                <div className="hb">
                  <div className="hb-f" style={{ width: `${revenuePct}%`, background: revenuePct >= 100 ? 'var(--ok)' : revenuePct >= 70 ? 'var(--accent)' : 'var(--warn)' }} />
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--ink-4)', marginTop: '4px', fontFamily: 'var(--mono)' }}>
                  {revenuePct.toFixed(0)}% complete
                </div>
              </div>
              <div className="hb-row">
                <div className="hb-head">
                  <span className="lbl">Sales Count</span>
                  <span className="v">{salesCount} / {countTarget}</span>
                </div>
                <div className="hb">
                  <div className="hb-f" style={{ width: `${countPct}%`, background: countPct >= 100 ? 'var(--ok)' : countPct >= 70 ? 'var(--accent)' : 'var(--warn)' }} />
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--ink-4)', marginTop: '4px', fontFamily: 'var(--mono)' }}>
                  {countPct.toFixed(0)}% complete
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Recent Coaching Sessions ────────────────────────── */}
      {coachingSessions.length > 0 && (
        <div className="pn">
          <div className="pn-t" style={{ marginBottom: '14px' }}>Recent Coaching Sessions</div>
          {coachingSessions.map((s: any) => (
            <div key={s.id} className="r-cd" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.type} Session</div>
                <div style={{ fontSize: '11px', color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
                  {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              {s.notes && (
                <div style={{ fontSize: '12px', color: 'var(--ink-2)', marginBottom: '6px', lineHeight: 1.55 }}>{s.notes}</div>
              )}
              {s.action_plan && (
                <div style={{ background: 'var(--accent-soft)', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', color: 'var(--accent-ink)', marginBottom: '6px' }}>
                  <strong>Action Plan:</strong> {s.action_plan}
                </div>
              )}
              {s.next_review && (
                <div style={{ fontSize: '11px', color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
                  Next review: {new Date(s.next_review).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
