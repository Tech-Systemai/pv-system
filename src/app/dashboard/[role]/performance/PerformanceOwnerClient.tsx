'use client';

import { Fragment, useState } from 'react';
import { dbOp } from '@/utils/db';

interface Employee {
  id: string;
  name: string;
  role: string;
  points: number;
  salary: number;
  department?: string;
}

interface Violation {
  id: string;
  user_id: string;
  rule_name: string;
  explanation: string;
  points_deducted: number;
  salary_deducted: number;
  triggered_at: string;
  acknowledged: boolean;
}

interface Props {
  currentProfile: any;
  employees: Employee[];
  allViolations: Violation[];
}

function getPointsColor(pts: number) {
  return pts >= 6 ? 'var(--ok)' : pts >= 4 ? 'var(--warn)' : 'var(--err)';
}
function getScoreLabel(pts: number) {
  return pts >= 6 ? 'Excellent' : pts >= 4 ? 'Fair' : 'At Risk';
}

export default function PerformanceOwnerClient({ currentProfile, employees, allViolations }: Props) {
  const [vList, setVList] = useState(allViolations);
  const [empList, setEmpList] = useState(employees);
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);

  // Add Deduction modal
  const [showAddDeduction, setShowAddDeduction] = useState(false);
  const [dAgent, setDAgent] = useState('');
  const [dRule, setDRule] = useState('');
  const [dPoints, setDPoints] = useState('');
  const [dSalary, setDSalary] = useState('');
  const [dExplanation, setDExplanation] = useState('');
  const [dSaving, setDSaving] = useState(false);

  // Coaching modal
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [coachEmp, setCoachEmp] = useState('');
  const [coachDate, setCoachDate] = useState('');
  const [coachNotes, setCoachNotes] = useState('');
  const [coachSaving, setCoachSaving] = useState(false);

  // Report modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportEmp, setReportEmp] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState<string | null>(null);

  const manageable = empList.filter(e => e.role !== 'owner');
  const avgScore = manageable.length > 0
    ? manageable.reduce((s, e) => s + (typeof e.points === 'number' ? e.points : 7), 0) / manageable.length
    : 7;
  const actionNeeded = manageable.filter(e => (e.points ?? 7) < 5).length;
  const totalDeductions = manageable.reduce((sum, e) => {
    const pts = typeof e.points === 'number' ? e.points : 7;
    return sum + Math.max(0, (7 - pts)) * 20;
  }, 0);

  const watchlist = manageable
    .filter(e => (e.points ?? 7) < 5)
    .sort((a, b) => (a.points ?? 7) - (b.points ?? 7))
    .slice(0, 5);
  const excellence = manageable
    .filter(e => (e.points ?? 7) >= 6)
    .sort((a, b) => (b.points ?? 7) - (a.points ?? 7))
    .slice(0, 5);

  const openAddDeduction = (empId?: string) => {
    if (empId) setDAgent(empId);
    setShowAddDeduction(true);
  };

  const closeAddDeduction = () => {
    setShowAddDeduction(false);
    setDAgent(''); setDRule(''); setDPoints(''); setDSalary(''); setDExplanation('');
  };

  const handleAddDeduction = async () => {
    const pts = parseFloat(dPoints);
    const sal = parseFloat(dSalary);
    if (!dAgent || !dRule.trim() || isNaN(pts) || pts <= 0) return;
    setDSaving(true);

    const targetEmp = empList.find(e => e.id === dAgent);
    const newPoints = Math.max(0, (targetEmp?.points ?? 7) - pts);

    await Promise.all([
      dbOp('violations', 'insert', {
        user_id: dAgent,
        rule_name: dRule.trim(),
        explanation: dExplanation.trim() || dRule.trim(),
        points_deducted: pts,
        salary_deducted: isNaN(sal) ? pts * 20 : sal,
        triggered_at: new Date().toISOString(),
        acknowledged: false,
      }),
      dbOp('profiles', 'update', { points: newPoints }, { id: dAgent }),
    ]);

    const now = new Date().toISOString();
    setVList(prev => [{
      id: Math.random().toString(36).slice(2),
      user_id: dAgent,
      rule_name: dRule.trim(),
      explanation: dExplanation.trim() || dRule.trim(),
      points_deducted: pts,
      salary_deducted: isNaN(sal) ? pts * 20 : sal,
      triggered_at: now,
      acknowledged: false,
    }, ...prev]);
    setEmpList(prev => prev.map(e => e.id === dAgent ? { ...e, points: newPoints } : e));
    closeAddDeduction();
    setDSaving(false);
  };

  const handleScheduleCoaching = async () => {
    if (!coachDate || !coachEmp) return;
    setCoachSaving(true);
    await dbOp('inbox_documents', 'insert', {
      user_id: coachEmp,
      title: `Coaching Session Scheduled — ${new Date(coachDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      content: coachNotes || 'A coaching session has been scheduled for you. Please confirm attendance.',
      type: 'Notice',
      sender: 'Management',
      requires_signature: true,
    });
    setShowCoachModal(false);
    setCoachDate(''); setCoachNotes(''); setCoachEmp('');
    setCoachSaving(false);
  };

  const handleSendReport = async () => {
    if (!reportEmp) return;
    setReportSending(true);
    const emp = empList.find(e => e.id === reportEmp);
    const pts = emp?.points ?? 7;
    const sal = emp?.salary ?? 2500;
    const deductions = Math.max(0, (7 - pts)) * 20;
    const empViolations = vList.filter(v => v.user_id === reportEmp);

    await dbOp('inbox_documents', 'insert', {
      user_id: reportEmp,
      title: `Monthly Performance Report — ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      content: [
        `Performance Report — ${emp?.name}`,
        `Role: ${emp?.role} | Department: ${emp?.department ?? 'N/A'}`,
        '',
        `Reliability Score: ${pts}/7`,
        `Base Salary: $${sal.toLocaleString()}`,
        `Deductions: -$${deductions}`,
        `Projected Net Pay: $${(sal - deductions).toLocaleString()}`,
        '',
        `Violations on record: ${empViolations.length}`,
        `Unacknowledged: ${empViolations.filter(v => !v.acknowledged).length}`,
      ].join('\n'),
      type: 'Report',
      sender: 'Management',
      requires_signature: false,
    });
    setReportSent(reportEmp);
    setShowReportModal(false);
    setReportEmp('');
    setReportSending(false);
  };

  const avgColor = getPointsColor(avgScore);

  return (
    <div className="page-fade">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em' }}>Everyone's Performance</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>
            Team-wide performance overview · {manageable.length} employee{manageable.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button className="btn btn-acc" onClick={() => openAddDeduction()}>+ Add Deduction</button>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div className="card card-body" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Average Score</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: avgColor, lineHeight: 1 }}>{avgScore.toFixed(1)}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-4)' }}>/7</span></div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{getScoreLabel(avgScore)} overall</div>
        </div>
        <div className="card card-body" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Action Needed</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: actionNeeded > 0 ? 'var(--err)' : 'var(--ok)', lineHeight: 1 }}>{actionNeeded}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>employee{actionNeeded !== 1 ? 's' : ''} below threshold</div>
        </div>
        <div className="card card-body" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Total Violations</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{vList.length}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{vList.filter(v => !v.acknowledged).length} unacknowledged</div>
        </div>
        <div className="card card-body" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Est. Deductions</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: totalDeductions > 0 ? 'oklch(0.45 0.16 25)' : 'var(--ok)', lineHeight: 1 }}>${totalDeductions.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>total salary impact</div>
        </div>
      </div>

      {/* Watchlist + Excellence */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        {/* Watchlist */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div>
              <div className="card-title">Watchlist</div>
              <div className="card-sub">Employees needing attention (score &lt; 5)</div>
            </div>
            {watchlist.length > 0 && <span className="bdg bdg-warn">{watchlist.length} Alert{watchlist.length !== 1 ? 's' : ''}</span>}
          </div>
          {watchlist.length === 0 ? (
            <div style={{ padding: '22px 16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>✓</div>
              No employees in watchlist
            </div>
          ) : (
            <div style={{ padding: 0 }}>
              {watchlist.map(emp => (
                <div key={emp.id}
                  onClick={() => setSelectedEmp(emp.id === selectedEmp ? null : emp.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer', background: selectedEmp === emp.id ? 'var(--surface-2)' : 'transparent' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--err-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--err)', flexShrink: 0 }}>
                    {(emp.points ?? 7).toFixed(1)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{emp.role}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: 'var(--err)', fontWeight: 600, background: 'var(--err-soft)', padding: '2px 7px', borderRadius: 4 }}>At Risk</span>
                    <button className="btn btn-sec btn-sm" style={{ fontSize: 10, padding: '2px 7px' }}
                      onClick={e => { e.stopPropagation(); setCoachEmp(emp.id); setShowCoachModal(true); }}>
                      Coach
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Excellence */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div>
              <div className="card-title">Excellence</div>
              <div className="card-sub">Top performers this period (score ≥ 6)</div>
            </div>
            {excellence.length > 0 && <span className="bdg bdg-ok">{excellence.length} Star{excellence.length !== 1 ? 's' : ''}</span>}
          </div>
          {excellence.length === 0 ? (
            <div style={{ padding: '22px 16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>📈</div>
              No top performers yet
            </div>
          ) : (
            <div style={{ padding: 0 }}>
              {excellence.map(emp => (
                <div key={emp.id}
                  onClick={() => setSelectedEmp(emp.id === selectedEmp ? null : emp.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer', background: selectedEmp === emp.id ? 'var(--surface-2)' : 'transparent' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--ok-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'oklch(0.42 0.12 155)', flexShrink: 0 }}>
                    {(emp.points ?? 7).toFixed(1)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{emp.role}</div>
                  </div>
                  <span style={{ fontSize: 10, color: 'oklch(0.42 0.12 155)', fontWeight: 600, background: 'var(--ok-soft)', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>Excellent</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Employee Role Score / Violation Deduction Table */}
      <div className="card" style={{ marginBottom: 14, overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Employee Role Score / Violation Deduction</div>
            <div className="card-sub">Click any row to view score breakdown, violations, and actions</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th style={{ textAlign: 'center' }}>Score</th>
                <th style={{ textAlign: 'right' }}>Violations</th>
                <th style={{ textAlign: 'right' }}>Est. Deduction</th>
                <th style={{ textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {manageable.map(emp => {
                const pts = typeof emp.points === 'number' ? emp.points : 7;
                const deduct = Math.max(0, (7 - pts)) * 20;
                const empViolations = vList.filter(v => v.user_id === emp.id);
                const pct = (pts / 7) * 100;
                const color = getPointsColor(pts);
                const isSelected = selectedEmp === emp.id;

                return (
                  <Fragment key={emp.id}>
                    <tr onClick={() => setSelectedEmp(isSelected ? null : emp.id)}
                      style={{ cursor: 'pointer', background: isSelected ? 'var(--surface-2)' : undefined }}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{emp.department ?? '—'}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ink-2)', textTransform: 'capitalize' }}>{emp.role}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 56, height: 5, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'var(--mono)', minWidth: 30 }}>{pts}/7</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        <span style={{ color: empViolations.length > 0 ? 'oklch(0.45 0.16 25)' : 'var(--ink-4)' }}>
                          {empViolations.length}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: deduct > 0 ? 'oklch(0.45 0.16 25)' : 'var(--ok)' }}>
                        {deduct > 0 ? `−$${deduct}` : '✓ None'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: pts >= 6 ? 'var(--ok-soft)' : pts >= 4 ? 'var(--warn-soft)' : 'var(--err-soft)',
                          color: pts >= 6 ? 'oklch(0.42 0.12 155)' : pts >= 4 ? 'oklch(0.45 0.12 75)' : 'var(--err)',
                        }}>
                          {getScoreLabel(pts)}
                        </span>
                      </td>
                    </tr>
                    {isSelected && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0 }}>
                          <EmployeeDetail
                            employee={emp}
                            violations={vList.filter(v => v.user_id === emp.id)}
                            onScheduleCoaching={() => { setCoachEmp(emp.id); setShowCoachModal(true); }}
                            onSendReport={() => { setReportEmp(emp.id); setShowReportModal(true); }}
                            onAddDeduction={() => openAddDeduction(emp.id)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {manageable.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '28px 18px', fontSize: 13 }}>
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Deduction Modal */}
      {showAddDeduction && (
        <div className="mb">
          <div className="md" style={{ width: 500 }}>
            <div className="md-t">Add Deduction</div>
            <div className="pv-fld">
              <label>Agent / Employee</label>
              <select value={dAgent} onChange={e => setDAgent(e.target.value)} className="fld-input">
                <option value="">Select employee…</option>
                {manageable.map(e => (
                  <option key={e.id} value={e.id}>{e.name} — {e.role} (current: {e.points ?? 7}/7 pts)</option>
                ))}
              </select>
            </div>
            <div className="pv-fld">
              <label>Rule / Reason</label>
              <input className="fld-input" placeholder="e.g. Late Clock-In, Misconduct, Policy Violation…"
                value={dRule} onChange={e => setDRule(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="pv-fld">
                <label>Points to Deduct</label>
                <input className="fld-input" type="number" min="0.5" step="0.5" max="7" placeholder="e.g. 1"
                  value={dPoints}
                  onChange={e => {
                    setDPoints(e.target.value);
                    const pts = parseFloat(e.target.value);
                    if (!isNaN(pts)) setDSalary(String(pts * 20));
                  }} />
              </div>
              <div className="pv-fld">
                <label>Salary Impact ($)</label>
                <input className="fld-input" type="number" min="0" placeholder="Auto: pts × $20"
                  value={dSalary} onChange={e => setDSalary(e.target.value)} />
              </div>
            </div>
            <div className="pv-fld">
              <label>Explanation to Agent</label>
              <textarea className="fld-input" rows={3}
                placeholder="Describe the violation and why this deduction is being applied…"
                value={dExplanation} onChange={e => setDExplanation(e.target.value)}
                style={{ resize: 'vertical' }} />
            </div>
            {dAgent && dPoints && (
              <div style={{ background: 'var(--warn-soft)', padding: '8px 12px', borderRadius: 6, fontSize: 12, color: 'oklch(0.45 0.12 75)', marginBottom: 16 }}>
                ⚠ This will deduct <strong>{dPoints} pts</strong> from{' '}
                <strong>{empList.find(e => e.id === dAgent)?.name}</strong>'s score
                {dSalary ? ` and −$${dSalary} from their projected salary` : ''}.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-acc" onClick={handleAddDeduction}
                disabled={!dAgent || !dRule.trim() || !dPoints || dSaving}>
                {dSaving ? 'Applying…' : 'Apply Deduction'}
              </button>
              <button className="btn btn-sec" onClick={closeAddDeduction}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Coaching Modal */}
      {showCoachModal && (
        <div className="mb">
          <div className="md" style={{ width: 420 }}>
            <div className="md-t">Schedule Coaching Session</div>
            <div className="pv-fld">
              <label>Employee</label>
              <select value={coachEmp} onChange={e => setCoachEmp(e.target.value)} className="fld-input">
                <option value="">Select employee…</option>
                {manageable.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                ))}
              </select>
            </div>
            <div className="pv-fld">
              <label>Session Date</label>
              <input type="date" value={coachDate} onChange={e => setCoachDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="pv-fld">
              <label>Notes (optional)</label>
              <textarea rows={3} value={coachNotes} onChange={e => setCoachNotes(e.target.value)}
                placeholder="Topics to cover, context for the session…" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-acc" onClick={handleScheduleCoaching}
                disabled={!coachDate || !coachEmp || coachSaving}>
                {coachSaving ? 'Scheduling…' : 'Schedule & Notify Employee'}
              </button>
              <button className="btn btn-sec" onClick={() => { setShowCoachModal(false); setCoachEmp(''); setCoachDate(''); setCoachNotes(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Send Report Modal */}
      {showReportModal && (
        <div className="mb">
          <div className="md" style={{ width: 420 }}>
            <div className="md-t">Send Performance Report</div>
            <div className="pv-fld">
              <label>Employee</label>
              <select value={reportEmp} onChange={e => setReportEmp(e.target.value)} className="fld-input">
                <option value="">Select employee…</option>
                {manageable.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                ))}
              </select>
            </div>
            {reportEmp && (() => {
              const emp = empList.find(e => e.id === reportEmp);
              const pts = emp?.points ?? 7;
              const sal = emp?.salary ?? 2500;
              const deductions = Math.max(0, (7 - pts)) * 20;
              return (
                <div style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginBottom: 16 }}>
                  Score: {pts}/7 · Net: ${(sal - deductions).toLocaleString()} · Violations: {vList.filter(v => v.user_id === reportEmp).length}
                </div>
              );
            })()}
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 16 }}>
              This will send a performance summary to the selected employee's inbox including their score, projected payslip, and violations.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-acc" onClick={handleSendReport}
                disabled={!reportEmp || reportSending}>
                {reportSending ? 'Sending…' : 'Send to Inbox'}
              </button>
              <button className="btn btn-sec" onClick={() => { setShowReportModal(false); setReportEmp(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeDetail({ employee, violations, onScheduleCoaching, onSendReport, onAddDeduction }: {
  employee: Employee;
  violations: Violation[];
  onScheduleCoaching: () => void;
  onSendReport: () => void;
  onAddDeduction: () => void;
}) {
  const pts = typeof employee.points === 'number' ? employee.points : 7;
  const salary = typeof employee.salary === 'number' ? employee.salary : 2500;
  const deduction = Math.max(0, (7 - pts)) * 20;
  const net = salary - deduction;
  const color = getPointsColor(pts);
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ - ((pts / 7) * circ);

  return (
    <div style={{ background: 'var(--surface-2)', padding: '16px 20px', borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Score ring */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
            <svg width="76" height="76" viewBox="0 0 76 76" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="38" cy="38" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
              <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="6"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color, lineHeight: 1 }}>{pts}</div>
              <div style={{ fontSize: 9, color: 'var(--ink-4)' }}>/ 7</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Reliability Score</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 3 }}>Base: <strong>${salary.toLocaleString()}</strong></div>
            {deduction > 0 && (
              <div style={{ fontSize: 11.5, color: 'oklch(0.45 0.16 25)', marginBottom: 3 }}>Deduction: <strong>−${deduction}</strong></div>
            )}
            <div style={{ fontSize: 11.5, color: deduction > 0 ? 'oklch(0.45 0.16 25)' : 'var(--ok)', fontWeight: 600 }}>
              Net Pay: ${net.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Violations */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Violations ({violations.length})
          </div>
          {violations.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>✓ No violations on record</div>
          ) : (
            violations.slice(0, 3).map(v => (
              <div key={v.id} style={{ fontSize: 11.5, marginBottom: 5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: 'oklch(0.45 0.16 25)', fontWeight: 700, fontFamily: 'var(--mono)', minWidth: 44, fontSize: 11 }}>
                  −{v.points_deducted}pt
                </span>
                <span style={{ color: 'var(--ink-2)' }}>{v.rule_name}</span>
                {!v.acknowledged && (
                  <span style={{ fontSize: 9, color: 'oklch(0.45 0.12 75)', background: 'var(--warn-soft)', padding: '1px 5px', borderRadius: 3, fontWeight: 600, flexShrink: 0 }}>New</span>
                )}
              </div>
            ))
          )}
          {violations.length > 3 && (
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>+{violations.length - 3} more violations</div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
          <button className="btn btn-sec btn-sm" onClick={e => { e.stopPropagation(); onScheduleCoaching(); }}>
            Schedule Coaching
          </button>
          <button className="btn btn-sec btn-sm" onClick={e => { e.stopPropagation(); onSendReport(); }}>
            Send Report
          </button>
          <button className="btn btn-sec btn-sm"
            style={{ color: 'oklch(0.45 0.16 25)', borderColor: 'oklch(0.80 0.08 25)' }}
            onClick={e => { e.stopPropagation(); onAddDeduction(); }}>
            + Add Deduction
          </button>
        </div>
      </div>
    </div>
  );
}
