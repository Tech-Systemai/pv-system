'use client';

import { useState } from 'react';
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

function scoreColor(s: number) {
  return s >= 6 ? 'var(--ok)' : s >= 4 ? 'var(--warn)' : 'var(--err)';
}

function Avatar({ name, hue = 268, size = 28 }: { name: string; hue?: number; size?: number }) {
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="av-circle" style={{
      width: size, height: size, fontSize: size * 0.38, flexShrink: 0,
      background: `linear-gradient(135deg,oklch(0.55 0.13 ${hue}),oklch(0.42 0.16 ${hue + 20}))`,
    }}>{initials}</div>
  );
}

function roleHue(role: string) {
  const map: Record<string, number> = { owner: 268, admin: 220, supervisor: 195, sales: 155, cx: 75, accountant: 290 };
  return map[role] ?? 268;
}

export default function PerformanceOwnerClient({ currentProfile, employees, allViolations }: Props) {
  const [vList, setVList] = useState(allViolations);
  const [empList, setEmpList] = useState(employees);
  const [picked, setPicked] = useState<Employee | null>(null);
  const [addOpen, setAddOpen] = useState<string | null>(null);
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [coachEmp, setCoachEmp] = useState('');
  const [coachDate, setCoachDate] = useState('');
  const [coachNotes, setCoachNotes] = useState('');
  const [coachSaving, setCoachSaving] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportEmp, setReportEmp] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const manageable = empList.filter(e => e.role !== 'owner');
  const scores = manageable.map(e => typeof e.points === 'number' ? e.points : 7);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 7;
  const actionCount = scores.filter(s => s < 4).length;
  const watchCount = scores.filter(s => s >= 4 && s < 6).length;
  const excellentCount = scores.filter(s => s >= 6).length;
  const totalSalaryDeducted = vList.reduce((s, v) => s + (v.salary_deducted ?? 0), 0);

  const getViolations = (id: string) => vList.filter(v => v.user_id === id);
  const getDeductions = (emp: Employee) => {
    return getViolations(emp.id).reduce((s, v) => s + (v.salary_deducted ?? 0), 0);
  };

  const handleAddDeduction = async (empId: string, rule: string, pts: number, salary: number, explanation: string) => {
    const targetEmp = empList.find(e => e.id === empId);
    const newPoints = Math.max(0, (targetEmp?.points ?? 7) - pts);
    await Promise.all([
      dbOp('violations', 'insert', {
        user_id: empId, rule_name: rule,
        explanation: explanation || rule,
        points_deducted: pts, salary_deducted: salary,
        triggered_at: new Date().toISOString(), acknowledged: false,
      }),
      dbOp('profiles', 'update', { points: newPoints }, { id: empId }),
    ]);
    setVList(prev => [{
      id: Math.random().toString(36).slice(2), user_id: empId, rule_name: rule,
      explanation: explanation || rule, points_deducted: pts, salary_deducted: salary,
      triggered_at: new Date().toISOString(), acknowledged: false,
    }, ...prev]);
    setEmpList(prev => prev.map(e => e.id === empId ? { ...e, points: newPoints } : e));
    showToast(`Deduction added · ${pts} pts ($${salary}) — ${targetEmp?.name.split(' ')[0]} notified`);
    setAddOpen(null);
  };

  const handleScheduleCoaching = async () => {
    if (!coachDate || !coachEmp) return;
    setCoachSaving(true);
    await dbOp('inbox_documents', 'insert', {
      user_id: coachEmp,
      title: `Coaching Session Scheduled — ${new Date(coachDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      content: coachNotes || 'A coaching session has been scheduled for you. Please confirm attendance.',
      type: 'Notice', sender: 'Management', requires_signature: true,
    });
    showToast('Coaching session scheduled · employee notified');
    setShowCoachModal(false); setCoachEmp(''); setCoachDate(''); setCoachNotes('');
    setCoachSaving(false);
  };

  const handleSendReport = async () => {
    if (!reportEmp) return;
    setReportSending(true);
    const emp = empList.find(e => e.id === reportEmp);
    const pts = emp?.points ?? 7;
    const sal = emp?.salary ?? 2500;
    const ded = getDeductions(emp!);
    const empViolations = getViolations(reportEmp);
    await dbOp('inbox_documents', 'insert', {
      user_id: reportEmp,
      title: `Monthly Performance Report — ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      content: [
        `Performance Report — ${emp?.name}`,
        `Role: ${emp?.role}`,
        '', `Reliability Score: ${pts}/7`,
        `Base Salary: $${sal.toLocaleString()}`, `Deductions: -$${ded}`,
        `Projected Net Pay: $${(sal - ded).toLocaleString()}`,
        '', `Violations: ${empViolations.length}`,
        `Unacknowledged: ${empViolations.filter(v => !v.acknowledged).length}`,
      ].join('\n'),
      type: 'Report', sender: 'Management', requires_signature: false,
    });
    showToast(`Report sent to ${emp?.name?.split(' ')[0]}'s inbox`);
    setShowReportModal(false); setReportEmp('');
    setReportSending(false);
  };

  return (
    <div className="page-fade">
      {/* 4 stat pills */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-h">
            <div className="stat-ico ind">📊</div>
            <span className={`stat-trend ${avgScore >= 6 ? 'up' : avgScore >= 4 ? 'flat' : 'down'}`}>
              {avgScore.toFixed(1)} / 7
            </span>
          </div>
          <div className="stat-l">TEAM AVG SCORE</div>
          <div className="stat-v">{avgScore.toFixed(1)}</div>
          <div className="stat-foot">{manageable.length} employees tracked</div>
        </div>
        <div className="stat-card">
          <div className="stat-h">
            <div className="stat-ico er">!</div>
            {actionCount > 0 && <span className="stat-trend down">{actionCount} urgent</span>}
          </div>
          <div className="stat-l">ACTION NEEDED</div>
          <div className="stat-v">{actionCount}</div>
          <div className="stat-foot">below 4.0 threshold</div>
        </div>
        <div className="stat-card">
          <div className="stat-h">
            <div className="stat-ico wn">◐</div>
          </div>
          <div className="stat-l">WATCH LIST</div>
          <div className="stat-v">{watchCount}</div>
          <div className="stat-foot">4.0 – 5.9</div>
        </div>
        <div className="stat-card">
          <div className="stat-h">
            <div className="stat-ico ok">✓</div>
          </div>
          <div className="stat-l">EXCELLENT</div>
          <div className="stat-v">{excellentCount}</div>
          <div className="stat-foot">6.0 +</div>
        </div>
        <div className="stat-card">
          <div className="stat-h">
            <div className="stat-ico er">$</div>
            {totalSalaryDeducted > 0 && <span className="stat-trend down">This period</span>}
          </div>
          <div className="stat-l">TOTAL DEDUCTED</div>
          <div className="stat-v">${totalSalaryDeducted.toLocaleString()}</div>
          <div className="stat-foot">{vList.filter(v => !v.acknowledged).length} unacknowledged</div>
        </div>
      </div>

      {/* Everyone's performance table */}
      <div className="card" style={{ marginBottom: 14, overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Everyone's performance</div>
            <div className="card-sub">Click any row to see violations · add deductions manually if needed</div>
          </div>
          <button className="btn btn-acc btn-sm" onClick={() => setAddOpen('quick')}>+ Add deduction</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Score</th>
                <th>Violations</th>
                <th>Deductions MTD</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {manageable.map(emp => {
                const pts = typeof emp.points === 'number' ? emp.points : 7;
                const ded = getDeductions(emp);
                const violations = getViolations(emp.id).length;
                const col = scoreColor(pts);
                return (
                  <tr key={emp.id} style={{ cursor: 'pointer' }} onClick={() => setPicked(emp)}>
                    <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Avatar name={emp.name} hue={roleHue(emp.role)} size={22} />
                      {emp.name}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{emp.role}</td>
                    <td className="mono" style={{ fontSize: 14, fontWeight: 600, color: col }}>{pts.toFixed(1)}</td>
                    <td className="mono">{violations}</td>
                    <td className="mono" style={{ color: ded ? 'var(--err)' : 'var(--ink-4)' }}>
                      {ded ? `− $${ded}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm"
                        onClick={e => { e.stopPropagation(); setAddOpen(emp.id); }}>
                        + Deduction
                      </button>
                      <button className="btn btn-acc btn-sm"
                        onClick={e => { e.stopPropagation(); setPicked(emp); }}>
                        Open →
                      </button>
                    </td>
                  </tr>
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

      {/* two-col: Top performers + Needs intervention */}
      <div className="two-col">
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div className="card-title">Top performers · this month</div>
          </div>
          <div className="card-body">
            {manageable.slice().sort((a, b) => (b.points ?? 7) - (a.points ?? 7)).slice(0, 4).map((emp, i) => (
              <div key={emp.id} style={{
                display: 'grid', gridTemplateColumns: '24px auto 1fr auto', gap: 10,
                alignItems: 'center', padding: '10px 0',
                borderBottom: i < 3 ? '1px solid var(--line-2)' : 'none',
              }}>
                <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 11 }}>#{i + 1}</span>
                <Avatar name={emp.name} hue={roleHue(emp.role)} size={28} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{emp.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'capitalize' }}>{emp.role}</div>
                </div>
                <span className="mono" style={{ color: 'var(--ok)', fontWeight: 600 }}>
                  {(emp.points ?? 7).toFixed(1)}
                </span>
              </div>
            ))}
            {manageable.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>No employees yet.</div>
            )}
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div className="card-title">Needs intervention</div>
            <div className="card-sub">Below 4.0</div>
          </div>
          <div className="card-body">
            {manageable.filter(e => (e.points ?? 7) < 4).length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
                No one below threshold this month.
              </div>
            ) : (
              manageable.filter(e => (e.points ?? 7) < 4).map((emp, i, arr) => (
                <div key={emp.id} style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 10,
                  alignItems: 'center', padding: '10px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--line-2)' : 'none',
                }}>
                  <Avatar name={emp.name} hue={roleHue(emp.role)} size={28} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{emp.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      {getViolations(emp.id).length} violations · score {(emp.points ?? 7).toFixed(1)}
                    </div>
                  </div>
                  <button className="btn btn-sec btn-sm"
                    onClick={() => { setCoachEmp(emp.id); setShowCoachModal(true); }}>
                    Coaching
                  </button>
                  <button className="btn btn-acc btn-sm" onClick={() => setAddOpen(emp.id)}>
                    + Action
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Employee detail modal */}
      {picked && (
        <div className="mb" onClick={e => { if (e.target === e.currentTarget) setPicked(null); }}>
          <div className="md" style={{ width: 620 }}>
            <div className="md-t">{picked.name} · Performance</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14, marginTop: -8, textTransform: 'capitalize' }}>
              {picked.role}{picked.department ? ` · ${picked.department}` : ''} · score {(picked.points ?? 7).toFixed(1)} / 7
            </div>

            {/* 3-col stats */}
            <div style={{
              padding: 16, background: 'var(--surface-2)', borderRadius: 9,
              marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14,
            }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Score</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: scoreColor(picked.points ?? 7) }}>{(picked.points ?? 7).toFixed(1)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Violations</div>
                <div style={{ fontSize: 22, fontWeight: 600 }}>{getViolations(picked.id).length}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Deductions</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: getDeductions(picked) > 0 ? 'var(--err)' : 'var(--ink-4)' }}>
                  ${getDeductions(picked)}
                </div>
              </div>
            </div>

            {getViolations(picked.id).length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Recent violations
                </div>
                {getViolations(picked.id).slice(0, 3).map(v => (
                  <div key={v.id} style={{ fontSize: 12, padding: '7px 0', borderBottom: '1px solid var(--line-2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span className="mono" style={{ color: 'var(--err)', fontWeight: 600, minWidth: 50, fontSize: 11 }}>−{v.points_deducted}pt</span>
                    <span style={{ fontWeight: 600 }}>{v.rule_name}</span>
                    {!v.acknowledged && <span className="bdg bdg-warn" style={{ fontSize: 9 }}>New</span>}
                  </div>
                ))}
                {getViolations(picked.id).length > 3 && (
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 6 }}>
                    +{getViolations(picked.id).length - 3} more violations
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14, lineHeight: 1.6 }}>
              Open this employee's full <strong>My Performance</strong> view to see attendance, coaching, and target progress.
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-acc btn-sm" onClick={() => { setAddOpen(picked.id); setPicked(null); }}>
                + Add deduction
              </button>
              <button className="btn btn-sec btn-sm" onClick={() => { setCoachEmp(picked.id); setPicked(null); setShowCoachModal(true); }}>
                Schedule coaching
              </button>
              <button className="btn btn-sec btn-sm" onClick={() => { setReportEmp(picked.id); setPicked(null); setShowReportModal(true); }}>
                Send report
              </button>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setPicked(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Deduction Modal */}
      {addOpen && (
        <AddDeductionModal
          empId={addOpen === 'quick' ? null : addOpen}
          employees={manageable}
          onClose={() => setAddOpen(null)}
          onAdd={handleAddDeduction}
        />
      )}

      {/* Schedule Coaching Modal */}
      {showCoachModal && (
        <div className="mb" onClick={e => { if (e.target === e.currentTarget) setShowCoachModal(false); }}>
          <div className="md" style={{ width: 420 }}>
            <div className="md-t">Schedule Coaching Session</div>
            <div className="pv-fld">
              <label>Employee</label>
              <select value={coachEmp} onChange={e => setCoachEmp(e.target.value)} className="fld-input">
                <option value="">Select employee…</option>
                {manageable.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
              </select>
            </div>
            <div className="pv-fld">
              <label>Session Date</label>
              <input type="date" value={coachDate} onChange={e => setCoachDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} className="fld-input" />
            </div>
            <div className="pv-fld">
              <label>Notes (optional)</label>
              <textarea className="fld-input" rows={3} value={coachNotes} onChange={e => setCoachNotes(e.target.value)}
                placeholder="Topics to cover, context for the session…" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-acc" onClick={handleScheduleCoaching} disabled={!coachDate || !coachEmp || coachSaving}>
                {coachSaving ? 'Scheduling…' : 'Schedule & Notify Employee'}
              </button>
              <button className="btn btn-sec" onClick={() => { setShowCoachModal(false); setCoachEmp(''); setCoachDate(''); setCoachNotes(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Report Modal */}
      {showReportModal && (
        <div className="mb" onClick={e => { if (e.target === e.currentTarget) setShowReportModal(false); }}>
          <div className="md" style={{ width: 420 }}>
            <div className="md-t">Send Performance Report</div>
            <div className="pv-fld">
              <label>Employee</label>
              <select value={reportEmp} onChange={e => setReportEmp(e.target.value)} className="fld-input">
                <option value="">Select employee…</option>
                {manageable.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
              </select>
            </div>
            {reportEmp && (() => {
              const emp = empList.find(e => e.id === reportEmp);
              const pts = emp?.points ?? 7;
              const sal = emp?.salary ?? 2500;
              const ded = getDeductions(emp!);
              return (
                <div style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginBottom: 14 }}>
                  Score: {pts.toFixed(1)}/7 · Net: ${(sal - ded).toLocaleString()} · Violations: {getViolations(reportEmp).length}
                </div>
              );
            })()}
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 16 }}>
              This will send a performance summary to the selected employee's inbox including their score, projected payslip, and violations.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-acc" onClick={handleSendReport} disabled={!reportEmp || reportSending}>
                {reportSending ? 'Sending…' : 'Send to Inbox'}
              </button>
              <button className="btn btn-sec" onClick={() => { setShowReportModal(false); setReportEmp(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="tst">{toast}</div>}
    </div>
  );
}

function AddDeductionModal({ empId, employees, onClose, onAdd }: {
  empId: string | null;
  employees: Employee[];
  onClose: () => void;
  onAdd: (empId: string, rule: string, pts: number, salary: number, explanation: string) => Promise<void>;
}) {
  const [agent, setAgent] = useState(empId || (employees[0]?.id ?? ''));
  const [rule, setRule] = useState('Late clock-in');
  const [pts, setPts] = useState(1.0);
  const [salary, setSalary] = useState(20);
  const [why, setWhy] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!agent) return;
    setSaving(true);
    await onAdd(agent, rule, pts, salary, why);
    setSaving(false);
  };

  return (
    <div className="mb" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="md" style={{ width: 520 }}>
        <div className="md-t">Add deduction</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16, marginTop: -8 }}>
          Manually flag a violation — employee is notified and can acknowledge
        </div>

        {!empId && (
          <div className="pv-fld">
            <label>Agent</label>
            <select className="fld-input" value={agent} onChange={e => setAgent(e.target.value)}>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        )}

        <div className="pv-fld">
          <label>Rule</label>
          <select className="fld-input" value={rule} onChange={e => setRule(e.target.value)}>
            <option>Late clock-in</option>
            <option>No-show</option>
            <option>Low productivity</option>
            <option>Excessive break</option>
            <option>Quality / coaching</option>
            <option>Custom</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="pv-fld">
            <label>Points (0.5 — 2.0)</label>
            <input className="fld-input mono" type="number" step="0.5" min="0.5" max="2"
              value={pts} onChange={e => { setPts(+e.target.value); setSalary(+e.target.value * 20); }} />
          </div>
          <div className="pv-fld">
            <label>Salary impact (USD)</label>
            <input className="fld-input mono" type="number"
              value={salary} onChange={e => setSalary(+e.target.value)} />
          </div>
        </div>

        <div className="pv-fld">
          <label>Explanation (visible to employee)</label>
          <textarea className="fld-input" rows={3} value={why} onChange={e => setWhy(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Be specific. E.g. 'Clocked in at 09:14 on May 6th, 14 minutes late.'" />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-sec btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-acc btn-sm" onClick={handleSubmit} disabled={saving || !agent}>
            {saving ? 'Adding…' : 'Add deduction'}
          </button>
        </div>
      </div>
    </div>
  );
}
