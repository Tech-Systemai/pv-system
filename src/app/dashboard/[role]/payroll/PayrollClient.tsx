'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const PERIOD = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

function buildPayslipHtml(emp: any, item: any, empViolations: any[]): string {
  const date = new Date().toLocaleDateString();
  const vRows = empViolations.map(v => `
    <tr>
      <td style="padding:7px 10px;font-weight:500;font-size:12px">${v.rule_name ?? ''}</td>
      <td style="padding:7px 10px;color:#64748b;font-size:12px">${v.explanation ?? ''}</td>
      <td style="padding:7px 10px;color:#94a3b8;font-size:12px;white-space:nowrap">${new Date(v.triggered_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</td>
      <td style="padding:7px 10px;text-align:right;color:#ef4444;font-size:12px">−${v.points_deducted ?? 0}</td>
      <td style="padding:7px 10px;text-align:right;color:#ef4444;font-weight:600;font-size:12px">−$${(v.salary_deducted ?? 0).toFixed(2)}</td>
    </tr>`).join('');
  const bonusRow = (item.bonuses ?? 0) > 0
    ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px"><span style="color:#475569">Bonus</span><span style="font-weight:600;color:#10b981">+$${item.bonuses}</span></div>` : '';
  const deductTable = empViolations.length > 0 ? `
    <div style="margin-bottom:24px">
      <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:10px">Deduction Detail</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f8fafc">
          <th style="text-align:left;padding:8px 10px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;font-size:11px">Rule</th>
          <th style="text-align:left;padding:8px 10px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;font-size:11px">Reason</th>
          <th style="text-align:left;padding:8px 10px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;font-size:11px">Date</th>
          <th style="text-align:right;padding:8px 10px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;font-size:11px">Points</th>
          <th style="text-align:right;padding:8px 10px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;font-size:11px">Amount</th>
        </tr></thead>
        <tbody>${vRows}</tbody>
        <tfoot><tr style="background:#fff7f7">
          <td colspan="4" style="padding:8px 10px;font-weight:700;font-size:13px">Total Deductions</td>
          <td style="padding:8px 10px;text-align:right;font-weight:700;color:#ef4444;font-size:13px">−$${item.deductions.toLocaleString()}</td>
        </tr></tfoot>
      </table>
      ${item.slip?.deduction_notes ? `<div style="margin-top:8px;font-size:12px;color:#64748b;padding:6px 10px;background:#fffbeb;border-radius:6px;border-left:3px solid #f59e0b">Note: ${item.slip.deduction_notes}</div>` : ''}
    </div>` : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Payslip — ${PERIOD}</title>
<style>body{font-family:Inter,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 40px;color:#1a1f2e;line-height:1.6}table{width:100%;border-collapse:collapse}@media print{body{margin:0}}</style>
</head><body>
<div style="border-bottom:2px solid #4f46e5;padding-bottom:20px;margin-bottom:30px;display:flex;justify-content:space-between;align-items:flex-start">
  <div style="display:flex;align-items:center;gap:15px">
    <div style="width:50px;height:50px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px">PV</div>
    <div><div style="font-size:24px;font-weight:800;color:#0f172a">Pioneers Veneers</div><div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Official Payslip Document</div></div>
  </div>
  <div style="text-align:right"><div style="font-size:14px;font-weight:600">Period: ${PERIOD}</div><div style="font-size:12px;color:#64748b">Generated: ${date}</div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:30px">
  <div>
    <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:8px">Employee</div>
    <div style="font-size:18px;font-weight:700;color:#0f172a">${emp.name}</div>
    <div style="font-size:13px;color:#475569">${emp.role}${emp.department ? ' · ' + emp.department : ''}</div>
    <div style="font-size:12px;color:#475569;margin-top:8px;line-height:1.6">Days present: ${item.att?.daysPresent ?? '—'}<br>Days late: ${item.att?.daysLate ?? '—'}<br>Tracked hours: ${Math.floor((item.att?.totalMins ?? 0)/60)}h ${(item.att?.totalMins ?? 0)%60}m</div>
  </div>
  <div style="background:#f8fafc;padding:20px;border-radius:12px">
    <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:10px">Payment Summary</div>
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px"><span style="color:#475569">Base Salary</span><span style="font-weight:600">$${item.base.toLocaleString()}</span></div>
    ${bonusRow}
    <div style="display:flex;justify-content:space-between;margin-bottom:16px;border-bottom:1px solid #e2e8f0;padding-bottom:12px;font-size:13px"><span style="color:#ef4444">Total Deductions</span><span style="color:#ef4444;font-weight:600">−$${item.deductions.toLocaleString()}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:15px;font-weight:700">Net Pay</span><span style="font-size:24px;font-weight:800;color:#10b981">$${item.net.toLocaleString()}</span></div>
  </div>
</div>
${deductTable}
<div style="margin-top:40px;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:20px">
  <div style="width:40%"><div style="border-top:1px solid #94a3b8;padding-top:4px;margin-top:40px"><div style="font-weight:600;font-size:12px">Finance Department</div><div style="font-size:11px;color:#64748b">Pioneers Veneers — Authorized Signature</div></div></div>
  <div style="width:40%;text-align:right"><div style="border-top:1px solid #94a3b8;padding-top:4px;margin-top:40px"><div style="font-weight:600;font-size:12px">Employee Acknowledgement</div><div style="font-size:11px;color:#64748b">${emp.name}</div></div></div>
</div>
<div style="margin-top:24px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #f1f5f9;padding-top:12px">Official payslip · Pioneers Veneers Enterprise Platform · ${PERIOD} · ${date}</div>
</body></html>`;
}

export default function PayrollClient({
  employees,
  initialPayrolls,
  attendanceLogs,
  violations,
}: {
  employees: any[];
  initialPayrolls: any[];
  attendanceLogs: any[];
  violations: any[];
}) {
  const [payrolls, setPayrolls] = useState(initialPayrolls);
  const [isProcessing, setIsProcessing] = useState(false);
  const [printSlip, setPrintSlip] = useState<any>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [editItem, setEditItem] = useState<any>(null);
  const [editBase, setEditBase] = useState('');
  const [editBonus, setEditBonus] = useState('');
  const [editAdj, setEditAdj] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const attendanceByUser: Record<string, { totalMins: number; daysPresent: number; daysLate: number }> = {};
  for (const log of attendanceLogs) {
    if (!attendanceByUser[log.user_id]) attendanceByUser[log.user_id] = { totalMins: 0, daysPresent: 0, daysLate: 0 };
    attendanceByUser[log.user_id].totalMins += log.productive_time_minutes ?? 0;
    if (log.clock_in_time) attendanceByUser[log.user_id].daysPresent++;
    if (log.status === 'late') attendanceByUser[log.user_id].daysLate++;
  }

  // Violations indexed by user for quick lookup
  const violationsByUser: Record<string, any[]> = {};
  for (const v of violations) {
    if (!violationsByUser[v.user_id]) violationsByUser[v.user_id] = [];
    violationsByUser[v.user_id].push(v);
  }

  const getAutoDeductions = (empId: string): number =>
    parseFloat((violationsByUser[empId] ?? [])
      .reduce((s: number, v: any) => s + (v.salary_deducted ?? 0), 0).toFixed(2));

  const handleProcessAll = async () => {
    if (!confirm(`Process payroll for ${PERIOD}? This will create approved payslips for all employees.`)) return;
    setIsProcessing(true);
    const newPayrolls = employees.map(e => {
      const deductions = getAutoDeductions(e.id);
      const base_salary = e.salary || 2500;
      const net_pay = parseFloat((base_salary - deductions).toFixed(2));
      return { user_id: e.id, period: PERIOD, base_salary, deductions, bonuses: 0, manual_adj: 0, net_pay, status: 'Approved' };
    });
    const { data, error } = await dbOp('payrolls', 'insert', newPayrolls);
    if (error) { showToast(`Error: ${error}`); }
    else if (data) { setPayrolls([...data, ...payrolls]); showToast('Payroll processed'); }
    setIsProcessing(false);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditBase(String(item.base));
    setEditBonus(String(item.slip?.bonuses ?? 0));
    setEditAdj(String(item.slip?.manual_adj ?? 0));
    setEditNotes(item.slip?.deduction_notes ?? '');
  };

  const handleEditSave = async () => {
    if (!editItem) return;
    setEditSaving(true);
    const base = parseFloat(editBase) || editItem.base;
    const bonus = parseFloat(editBonus) || 0;
    const adj = parseFloat(editAdj) || 0;
    const autoDeductions = getAutoDeductions(editItem.emp.id);
    const totalDeductions = parseFloat((autoDeductions - adj).toFixed(2)); // adj = positive means reduce deduction
    const net = parseFloat((base + bonus - Math.max(0, totalDeductions)).toFixed(2));

    const patch = {
      base_salary: base, bonuses: bonus, manual_adj: adj,
      deductions: Math.max(0, totalDeductions), net_pay: net,
      deduction_notes: editNotes, status: 'Approved',
    };

    if (editItem.slip) {
      const { error } = await dbOp('payrolls', 'update', patch, { id: editItem.slip.id });
      if (error) { showToast(`Save failed: ${error}`); setEditSaving(false); return; }
      setPayrolls(prev => prev.map(p => p.id === editItem.slip.id ? { ...p, ...patch } : p));
    } else {
      const { data, error } = await dbOp('payrolls', 'insert', { user_id: editItem.emp.id, period: PERIOD, ...patch });
      if (error) { showToast(`Save failed: ${error}`); setEditSaving(false); return; }
      if (data?.[0]) setPayrolls(prev => [data[0], ...prev]);
    }
    showToast('Payslip saved');
    setEditItem(null);
    setEditSaving(false);
  };

  const handleSendToInbox = async (emp: any, item: any) => {
    setSending(emp.id);
    const empViolations = violationsByUser[emp.id] ?? [];
    const html = buildPayslipHtml(emp, item, empViolations);
    const subject = `Payslip — ${PERIOD}`;
    const { error } = await dbOp('inbox_documents', 'insert', {
      user_id: emp.id,
      title: subject, subject,
      content: `Your payslip for ${PERIOD} is ready. Net pay: $${item.net.toLocaleString()}. Please review and sign below.`,
      type: 'Payslip',
      sender: 'Finance / Management',
      requires_signature: true,
      is_read: false,
      html_content: html,
      doc_ref_type: 'payslip',
      doc_ref_id: String(item.slip?.id ?? emp.id),
    });
    if (error) { showToast(`Send failed: ${error}`); }
    else { setSent(prev => new Set([...prev, emp.id])); showToast(`Payslip sent to ${emp.name.split(' ')[0]}`); }
    setSending(null);
  };

  const currentPeriodList = employees.map(e => {
    const slip = payrolls.find(p => p.user_id === e.id && p.period === PERIOD);
    const autoDeductions = getAutoDeductions(e.id);
    const manualAdj = slip?.manual_adj ?? 0;
    const deductions = slip ? slip.deductions : autoDeductions;
    const base = slip ? slip.base_salary : (e.salary || 2500);
    const bonuses = slip?.bonuses ?? 0;
    const net = slip ? slip.net_pay : parseFloat((base - deductions).toFixed(2));
    const isApproved = slip?.status === 'Approved';
    const att = attendanceByUser[e.id] ?? { totalMins: 0, daysPresent: 0, daysLate: 0 };
    return { emp: e, base, deductions, net, bonuses, manualAdj, isApproved, slip, att };
  });

  const totalPayroll = currentPeriodList.reduce((s, i) => s + i.net, 0);
  const totalDeductions = currentPeriodList.reduce((s, i) => s + i.deductions, 0);
  const processedCount = currentPeriodList.filter(i => i.isApproved).length;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; box-sizing: border-box; }
          .no-print { display: none !important; }
        }
      ` }} />

      <div className="page-fade no-print">
        {/* Stat cards */}
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className="stat-ico ok">$</div></div>
            <div className="stat-l">TOTAL PAYROLL</div>
            <div className="stat-v">${totalPayroll.toLocaleString()}</div>
            <div className="stat-foot">{PERIOD}</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className="stat-ico er">↓</div></div>
            <div className="stat-l">TOTAL DEDUCTIONS</div>
            <div className="stat-v" style={{ color: 'var(--err)' }}>${totalDeductions.toLocaleString()}</div>
            <div className="stat-foot">From policy violations</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className="stat-ico ind">✓</div></div>
            <div className="stat-l">PROCESSED</div>
            <div className="stat-v">{processedCount}<span style={{ fontSize: 14, color: 'var(--ink-3)' }}>/{employees.length}</span></div>
            <div className="stat-foot">Approved payslips</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className="stat-ico ok">✉</div></div>
            <div className="stat-l">SENT TO INBOX</div>
            <div className="stat-v">{sent.size}</div>
            <div className="stat-foot">This session</div>
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div>
              <div className="card-title">Payroll · {PERIOD}</div>
              <div className="card-sub">Deductions pulled from policy violations · click Edit to add adjustments or bonuses</div>
            </div>
            <button className="btn btn-acc btn-sm" onClick={handleProcessAll} disabled={isProcessing}>
              {isProcessing ? 'Processing…' : '⚡ Process & Approve All'}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Attendance</th>
                  <th>Base Salary</th>
                  <th>Violations</th>
                  <th>Deductions</th>
                  <th>Bonus</th>
                  <th>Net Pay</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentPeriodList.map(item => {
                  const hue = ((item.emp.name || 'U').charCodeAt(0) * 13) % 360;
                  const empViolations = violationsByUser[item.emp.id] ?? [];
                  return (
                    <tr key={item.emp.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="av-circle" style={{ width: 30, height: 30, fontSize: 10, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                            {item.emp.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{item.emp.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{item.emp.role}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
                        {item.att.daysPresent}d · {item.att.daysLate}L · {Math.floor(item.att.totalMins / 60)}h
                      </td>
                      <td style={{ fontWeight: 600 }}>${item.base.toLocaleString()}</td>
                      <td style={{ fontSize: 11 }}>
                        {empViolations.length > 0 ? (
                          <div>
                            {empViolations.slice(0, 2).map((v: any, i: number) => (
                              <div key={i} style={{ color: 'var(--err)', whiteSpace: 'nowrap' }}>
                                {v.rule_name?.slice(0, 22)} −${(v.salary_deducted ?? 0).toFixed(2)}
                              </div>
                            ))}
                            {empViolations.length > 2 && (
                              <div style={{ color: 'var(--ink-4)' }}>+{empViolations.length - 2} more</div>
                            )}
                          </div>
                        ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </td>
                      <td>
                        {item.deductions > 0 ? (
                          <span style={{ color: 'var(--err)', fontWeight: 600 }}>−${item.deductions.toLocaleString()}</span>
                        ) : (
                          <span style={{ color: 'var(--ink-4)' }}>—</span>
                        )}
                      </td>
                      <td style={{ color: item.bonuses > 0 ? 'var(--ok)' : 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
                        {item.bonuses > 0 ? `+$${item.bonuses}` : '—'}
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 14, color: 'var(--ok)' }}>${item.net.toLocaleString()}</td>
                      <td>
                        {item.isApproved
                          ? <span className="bdg bdg-ok">Approved</span>
                          : <span className="bdg bdg-warn">Draft</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>✎ Edit</button>
                          {item.isApproved && (
                            <>
                              <button className="btn btn-sec btn-sm" onClick={() => setPrintSlip(item)}>PDF</button>
                              <button
                                className="btn btn-acc btn-sm"
                                disabled={sending === item.emp.id || sent.has(item.emp.id)}
                                onClick={() => handleSendToInbox(item.emp, item)}
                              >
                                {sent.has(item.emp.id) ? '✓' : sending === item.emp.id ? '…' : '✉'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit payslip modal */}
      {editItem && (() => {
        const empViolations = violationsByUser[editItem.emp.id] ?? [];
        const autoDeductions = getAutoDeductions(editItem.emp.id);
        const adjVal = parseFloat(editAdj) || 0;
        const bonusVal = parseFloat(editBonus) || 0;
        const baseVal = parseFloat(editBase) || editItem.base;
        const previewNet = parseFloat((baseVal + bonusVal - Math.max(0, autoDeductions - adjVal)).toFixed(2));
        return (
          <div className="mb" onClick={e => { if (e.target === e.currentTarget) setEditItem(null); }}>
            <div className="md" style={{ width: 560, maxHeight: '88vh', overflowY: 'auto' }}>
              <div className="md-t">Edit Payslip — {editItem.emp.name}</div>

              {/* Violation breakdown */}
              {empViolations.length > 0 && (
                <div style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginBottom: 8 }}>AUTO DEDUCTIONS FROM VIOLATIONS</div>
                  {empViolations.map((v: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: i < empViolations.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
                      <div>
                        <span style={{ fontWeight: 500 }}>{v.rule_name}</span>
                        <span style={{ color: 'var(--ink-4)', marginLeft: 8 }}>
                          {new Date(v.triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <span style={{ color: 'var(--err)', fontFamily: 'var(--mono)' }}>−${(v.salary_deducted ?? 0).toFixed(2)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, paddingTop: 8 }}>
                    <span>Total auto deductions</span>
                    <span style={{ color: 'var(--err)' }}>−${autoDeductions.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="pv-fld">
                  <label>Base Salary ($)</label>
                  <input className="fld-input mono" type="number" min="0" value={editBase} onChange={e => setEditBase(e.target.value)} />
                </div>
                <div className="pv-fld">
                  <label>Bonus ($)</label>
                  <input className="fld-input mono" type="number" min="0" value={editBonus} onChange={e => setEditBonus(e.target.value)} placeholder="0" />
                </div>
              </div>

              <div className="pv-fld">
                <label>Manual deduction adjustment ($) <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>— positive = reduce deductions (e.g. correction)</span></label>
                <input className="fld-input mono" type="number" value={editAdj} onChange={e => setEditAdj(e.target.value)} placeholder="0" />
              </div>

              <div className="pv-fld">
                <label>Notes for employee <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(appears on payslip)</span></label>
                <textarea className="fld-input" rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  placeholder="e.g. Deduction waived for approved leave" style={{ resize: 'vertical' }} />
              </div>

              <div style={{ background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 9, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--ink-3)' }}>Base salary</span>
                  <span>${baseVal.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--ink-3)' }}>Deductions (after adj.)</span>
                  <span style={{ color: 'var(--err)' }}>−${Math.max(0, autoDeductions - adjVal).toFixed(2)}</span>
                </div>
                {bonusVal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--ink-3)' }}>Bonus</span>
                    <span style={{ color: 'var(--ok)' }}>+${bonusVal}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, paddingTop: 8, borderTop: '1px solid var(--line-2)' }}>
                  <span>Net Pay</span>
                  <span style={{ color: 'var(--ok)' }}>${previewNet.toLocaleString()}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-acc" onClick={handleEditSave} disabled={editSaving}>
                  {editSaving ? 'Saving…' : 'Save & Approve'}
                </button>
                <button className="btn btn-sec" onClick={() => setEditItem(null)}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Print / PDF payslip */}
      {printSlip && (() => {
        const empViolations = violationsByUser[printSlip.emp.id] ?? [];
        return (
          <div className="print-container" style={{ background: '#fff', padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ borderBottom: '2px solid oklch(0.52 0.20 268)', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '10px', background: 'linear-gradient(135deg, oklch(0.52 0.20 268), oklch(0.42 0.22 280))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '20px' }}>PV</div>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>Pioneers Veneers</div>
                  <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Official Payslip Document</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Period: {PERIOD}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Generated: {new Date().toLocaleDateString()}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>Employee</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{printSlip.emp.name}</div>
                <div style={{ fontSize: '13px', color: '#475569' }}>{printSlip.emp.role} · {printSlip.emp.department}</div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '8px', lineHeight: 1.6 }}>
                  Days present: {printSlip.att.daysPresent}<br />
                  Days late: {printSlip.att.daysLate}<br />
                  Tracked hours: {Math.floor(printSlip.att.totalMins / 60)}h {printSlip.att.totalMins % 60}m
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '10px' }}>Payment Summary</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: '#475569' }}>Base Salary</span>
                  <span style={{ fontWeight: 600 }}>${printSlip.base.toLocaleString()}</span>
                </div>
                {(printSlip.bonuses ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#475569' }}>Bonus</span>
                    <span style={{ fontWeight: 600, color: '#10b981' }}>+${printSlip.bonuses}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', fontSize: '13px' }}>
                  <span style={{ color: '#ef4444' }}>Total Deductions</span>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>−${printSlip.deductions.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>Net Pay</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>${printSlip.net.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Itemized deductions */}
            {empViolations.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '10px' }}>Deduction Detail</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Rule</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Reason</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Date</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Points</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empViolations.map((v: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 500 }}>{v.rule_name}</td>
                        <td style={{ padding: '8px 10px', color: '#64748b', maxWidth: 260 }}>{v.explanation}</td>
                        <td style={{ padding: '8px 10px', color: '#94a3b8' }}>
                          {new Date(v.triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#ef4444' }}>−{v.points_deducted}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>−${(v.salary_deducted ?? 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#fff7f7' }}>
                      <td colSpan={4} style={{ padding: '8px 10px', fontWeight: 700, fontSize: '13px' }}>Total Deductions</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#ef4444', fontSize: '13px' }}>−${printSlip.deductions.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
                {printSlip.slip?.deduction_notes && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', padding: '6px 10px', background: '#fffbeb', borderRadius: 6, borderLeft: '3px solid #f59e0b' }}>
                    Note: {printSlip.slip.deduction_notes}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
              <div style={{ width: '40%' }}>
                <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, marginTop: 40 }}>
                  <div style={{ fontWeight: 600, fontSize: '12px' }}>Finance Department</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Pioneers Veneers — Authorized Signature</div>
                </div>
              </div>
              <div style={{ width: '40%', textAlign: 'right' }}>
                <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, marginTop: 40 }}>
                  <div style={{ fontWeight: 600, fontSize: '12px' }}>Employee Acknowledgement</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{printSlip.emp.name}</div>
                </div>
              </div>
            </div>

            <div className="no-print" style={{ textAlign: 'center', marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button className="btn btn-acc" onClick={() => window.print()}>Print / Download PDF</button>
              <button className="btn btn-sec" onClick={() => setPrintSlip(null)}>Close</button>
            </div>
          </div>
        );
      })()}

      {/* Toast */}
      {toast && <div className="tst">{toast}</div>}
    </>
  );
}
