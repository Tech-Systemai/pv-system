'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';
import { fmt, getPayDates, fmtDate, CURRENCIES, type CurrencyCode } from '@/utils/currency';

// Current period (month)
const NOW = new Date();
const PERIOD = NOW.toLocaleString('default', { month: 'long', year: 'numeric' });
const PERIOD_START = new Date(NOW.getFullYear(), NOW.getMonth(), 1).toISOString().slice(0, 10);
const PERIOD_END   = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0).toISOString().slice(0, 10);
const WEEKLY_NORMAL_MINS = 40 * 60; // 40 hours

type CustomItem = { id: string; description: string; amount: number; type: 'addition' | 'deduction' };
type EditCustomItem = { id: string; description: string; amount: string; type: 'addition' | 'deduction' };

function fmtH(mins: number) {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function fmtDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '';
  const s = start ? new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const e = end   ? new Date(end).toLocaleDateString('en-US',   { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return s && e ? `${s} – ${e}` : s || e;
}

/** ISO week key (YYYY-Www) used to group days into 40 h/week buckets */
function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function computeOvertime(logs: any[], overtimeRate: number) {
  const byWeek: Record<string, number> = {};
  for (const log of logs) {
    const dateStr = log.date || (log.clock_in_time ? String(log.clock_in_time).slice(0, 10) : null);
    if (!dateStr) continue;
    const key = isoWeekKey(dateStr);
    byWeek[key] = (byWeek[key] || 0) + (log.productive_time_minutes ?? 0);
  }
  let normalMins = 0, overtimeMins = 0;
  for (const w of Object.values(byWeek)) {
    normalMins   += Math.min(w, WEEKLY_NORMAL_MINS);
    overtimeMins += Math.max(0, w - WEEKLY_NORMAL_MINS);
  }
  const overtimePay = Math.round((overtimeMins / 60) * overtimeRate * 100) / 100;
  return { normalMins, overtimeMins, overtimePay };
}

function getCustomItemsNet(items: CustomItem[]): number {
  return items.reduce((s, ci) => s + (ci.type === 'addition' ? ci.amount : -ci.amount), 0);
}

function payScheduleHtml(emp: any): string {
  const payDates = getPayDates(emp.first_pay_date, 4);
  if (!payDates.length && !emp.start_date) return '';
  const cur = emp.currency || 'USD';
  const curSymbol = CURRENCIES[cur as CurrencyCode]?.symbol ?? '$';
  const dateItems = payDates.map((d, i) => {
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `<div style="padding:4px 10px;border-radius:5px;font-size:11px;background:${i === 0 ? '#4f46e5' : '#f1f5f9'};color:${i === 0 ? '#fff' : '#475569'};font-weight:${i === 0 ? 700 : 400}">${label}${i === 0 ? ' ← next' : ''}</div>`;
  }).join('');
  return `
    <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
      <div style="background:#f8fafc;padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Pay Schedule · Bi-weekly · ${curSymbol} ${cur}</div>
      <div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;gap:20px;font-size:12px;color:#475569">
          ${emp.start_date ? `<span><strong>Start:</strong> ${new Date(emp.start_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>` : ''}
          ${emp.training_end_date ? `<span><strong>Training until:</strong> ${new Date(emp.training_end_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>` : ''}
          ${emp.first_pay_date ? `<span><strong>First pay:</strong> ${new Date(emp.first_pay_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>` : ''}
        </div>
        ${payDates.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${dateItems}</div>` : ''}
      </div>
    </div>`;
}

function buildPayslipHtml(emp: any, item: any, empViolations: any[]): string {
  const date = new Date().toLocaleDateString();
  const att = item.att ?? { normalMins: 0, overtimeMins: 0, totalMins: 0, daysPresent: 0, daysLate: 0 };
  const customItems: CustomItem[] = item.slip?.custom_items ?? [];
  const cur = emp.currency || 'USD';
  const periodRange = fmtDateRange(item.slip?.period_start, item.slip?.period_end);

  const vRows = empViolations.map(v => `
    <tr>
      <td style="padding:7px 10px;font-weight:500;font-size:12px">${v.rule_name ?? '—'}</td>
      <td style="padding:7px 10px;color:#64748b;font-size:12px">${v.explanation ?? '—'}</td>
      <td style="padding:7px 10px;color:#94a3b8;font-size:12px;white-space:nowrap">${new Date(v.triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      <td style="padding:7px 10px;text-align:right;color:#ef4444;font-size:12px">−${v.points_deducted ?? 0}</td>
      <td style="padding:7px 10px;text-align:right;color:#ef4444;font-weight:600;font-size:12px">−${fmt(v.salary_deducted ?? 0, cur)}</td>
    </tr>`).join('');

  const otPay = item.slip?.overtime_pay ?? item.overtimePay ?? 0;
  const otRow = otPay > 0
    ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px"><span style="color:#475569">Overtime Pay (${fmtH(att.overtimeMins)})</span><span style="font-weight:600;color:#6366f1">+${fmt(otPay, cur)}</span></div>`
    : '';
  const bonusRow = (item.bonuses ?? 0) > 0
    ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px"><span style="color:#475569">Bonus</span><span style="font-weight:600;color:#10b981">+${fmt(item.bonuses, cur)}</span></div>` : '';
  const customItemRows = customItems.map(ci =>
    `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
      <span style="color:#475569">${ci.description || 'Custom item'}</span>
      <span style="font-weight:600;color:${ci.type === 'addition' ? '#10b981' : '#ef4444'}">${ci.type === 'addition' ? '+' : '−'}${fmt(ci.amount, cur)}</span>
    </div>`).join('');
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
          <td style="padding:8px 10px;text-align:right;font-weight:700;color:#ef4444;font-size:13px">−${fmt(item.deductions, cur)}</td>
        </tr></tfoot>
      </table>
      ${item.slip?.deduction_notes ? `<div style="margin-top:8px;font-size:12px;color:#64748b;padding:6px 10px;background:#fffbeb;border-radius:6px;border-left:3px solid #f59e0b">Note: ${item.slip.deduction_notes}</div>` : ''}
    </div>` : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Payslip — ${PERIOD}</title>
<style>body{font-family:Inter,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 40px;color:#1a1f2e;line-height:1.6}table{width:100%;border-collapse:collapse}@media print{body{margin:0}}</style>
</head><body>
<div style="border-bottom:2px solid #4f46e5;padding-bottom:20px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start">
  <div style="display:flex;align-items:center;gap:15px">
    <div style="width:50px;height:50px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px">PV</div>
    <div><div style="font-size:24px;font-weight:800;color:#0f172a">Pioneers Veneers</div><div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Official Payslip Document</div></div>
  </div>
  <div style="text-align:right">
    <div style="font-size:14px;font-weight:600">Period: ${PERIOD}</div>
    ${periodRange ? `<div style="font-size:12px;color:#4f46e5;font-weight:600">${periodRange}</div>` : ''}
    <div style="font-size:12px;color:#64748b">Generated: ${date}</div>
  </div>
</div>
${payScheduleHtml(emp)}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:30px">
  <div>
    <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:8px">Employee</div>
    <div style="font-size:18px;font-weight:700;color:#0f172a">${emp.name}</div>
    <div style="font-size:13px;color:#475569">${emp.role}${emp.department ? ' · ' + emp.department : ''}</div>
    <div style="font-size:12px;color:#475569;margin-top:8px;line-height:1.8">
      Days present: ${att.daysPresent}<br>Days late: ${att.daysLate}<br>
      Normal time: ${fmtH(att.normalMins)}<br>
      Overtime: ${fmtH(att.overtimeMins)} (${fmtH(att.overtimeMins)} beyond 40 h/wk)<br>
      Total tracked: ${fmtH(att.totalMins)}
    </div>
  </div>
  <div style="background:#f8fafc;padding:20px;border-radius:12px">
    <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:10px">Payment Summary (${cur})</div>
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px"><span style="color:#475569">Base Salary</span><span style="font-weight:600">${fmt(item.base, cur)}</span></div>
    ${otRow}
    ${bonusRow}
    ${customItemRows}
    <div style="display:flex;justify-content:space-between;margin-bottom:16px;border-bottom:1px solid #e2e8f0;padding-bottom:12px;font-size:13px"><span style="color:#ef4444">Total Deductions</span><span style="color:#ef4444;font-weight:600">−${fmt(item.deductions, cur)}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:15px;font-weight:700">Net Pay</span><span style="font-size:24px;font-weight:800;color:#10b981">${fmt(item.net, cur)}</span></div>
  </div>
</div>
${deductTable}
<div style="margin-top:40px;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:20px">
  <div style="width:40%"><div style="border-top:1px solid #94a3b8;padding-top:4px;margin-top:40px"><div style="font-weight:600;font-size:12px">Finance Department</div><div style="font-size:11px;color:#64748b">Pioneers Veneers — Authorized Signature</div></div></div>
  <div style="width:40%;text-align:right"><div style="border-top:1px solid #94a3b8;padding-top:4px;margin-top:40px"><div style="font-weight:600;font-size:12px">Employee Acknowledgement</div><div style="font-size:11px;color:#64748b">${emp.name}</div><div style="margin-top:8px;min-height:36px;font-family:'Dancing Script','Brush Script MT',cursive;font-size:28px;color:#1a1f2e"><!--EMP_SIG_PLACEHOLDER--></div><div style="font-size:10px;color:#94a3b8;margin-top:2px"><!--EMP_DATE_PLACEHOLDER-->Signature &amp; Date</div></div></div>
</div>
<div style="margin-top:24px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #f1f5f9;padding-top:12px">Official payslip · Pioneers Veneers Enterprise Platform · ${PERIOD} · ${date}</div>
</body></html>`;
}

export default function PayrollClient({
  employees,
  initialPayrolls,
  attendanceLogs,
  violations,
  currentUserId,
}: {
  employees: any[];
  initialPayrolls: any[];
  attendanceLogs: any[];
  violations: any[];
  currentUserId: string;
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
  const [editOvertimePay, setEditOvertimePay] = useState('');
  const [editCustomItems, setEditCustomItems] = useState<EditCustomItem[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [historyEmp, setHistoryEmp] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  // --- Attendance: group all-time logs by user (for history) and current-period logs (for OT calc) ---
  const currentMonth = NOW.getMonth();
  const currentYear  = NOW.getFullYear();

  const logsByUser: Record<string, any[]> = {};
  const currentPeriodLogsByUser: Record<string, any[]> = {};
  for (const log of attendanceLogs) {
    if (!logsByUser[log.user_id]) logsByUser[log.user_id] = [];
    logsByUser[log.user_id].push(log);
    const d = new Date(log.date || log.clock_in_time);
    if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
      if (!currentPeriodLogsByUser[log.user_id]) currentPeriodLogsByUser[log.user_id] = [];
      currentPeriodLogsByUser[log.user_id].push(log);
    }
  }

  // --- Attendance summary (all-time for totals; current period for OT) ---
  const attByUser: Record<string, { totalMins: number; normalMins: number; overtimeMins: number; daysPresent: number; daysLate: number; overtimePay: number }> = {};
  for (const emp of employees) {
    const periodLogs = currentPeriodLogsByUser[emp.id] ?? [];
    const rate = emp.overtime_rate ?? 200;
    const { normalMins, overtimeMins, overtimePay } = computeOvertime(periodLogs, rate);

    let totalMins = 0, daysPresent = 0, daysLate = 0;
    for (const log of periodLogs) {
      totalMins += log.productive_time_minutes ?? 0;
      if (log.clock_in_time) daysPresent++;
      if (log.status === 'late') daysLate++;
    }
    attByUser[emp.id] = { totalMins, normalMins, overtimeMins, daysPresent, daysLate, overtimePay };
  }

  // --- Violations by user (current period) ---
  const violationsByUser: Record<string, any[]> = {};
  for (const v of violations) {
    if (!violationsByUser[v.user_id]) violationsByUser[v.user_id] = [];
    violationsByUser[v.user_id].push(v);
  }

  const getAutoDeductions = (empId: string): number =>
    parseFloat((violationsByUser[empId] ?? []).reduce((s: number, v: any) => s + (v.salary_deducted ?? 0), 0).toFixed(2));

  // --- Current period list ---
  const currentPeriodList = employees.map(e => {
    const slip = payrolls.find(p => p.user_id === e.id && p.period === PERIOD);
    const autoDeductions = getAutoDeductions(e.id);
    const deductions  = slip ? slip.deductions  : autoDeductions;
    const base        = slip ? slip.base_salary : (e.salary || 2500);
    const bonuses     = slip?.bonuses ?? 0;
    const overtimePay = slip ? (slip.overtime_pay ?? 0) : (attByUser[e.id]?.overtimePay ?? 0);
    const customItems: CustomItem[] = slip?.custom_items ?? [];
    const customNet = getCustomItemsNet(customItems);
    const net = slip ? slip.net_pay : parseFloat((base + overtimePay + bonuses + customNet - deductions).toFixed(2));
    const isApproved = slip?.status === 'Approved';
    const att = attByUser[e.id] ?? { totalMins: 0, normalMins: 0, overtimeMins: 0, daysPresent: 0, daysLate: 0, overtimePay: 0 };
    const payDates = getPayDates(e.first_pay_date, 2);
    const isInTraining = e.start_date && e.training_end_date
      && NOW >= new Date(e.start_date) && NOW <= new Date(e.training_end_date);
    return { emp: e, base, deductions, net, bonuses, overtimePay, customItems, isApproved, slip, att, payDates, isInTraining };
  });

  const totalPayroll   = currentPeriodList.reduce((s, i) => s + i.net, 0);
  const totalDeductions = currentPeriodList.reduce((s, i) => s + i.deductions, 0);
  const processedCount = currentPeriodList.filter(i => i.isApproved).length;

  // --- Actions ---
  const handleProcessAll = async () => {
    if (!confirm(`Process payroll for ${PERIOD}? This creates approved payslips for all employees.`)) return;
    setIsProcessing(true);
    const newPayrolls = employees.map(e => {
      const deductions  = getAutoDeductions(e.id);
      const base_salary = e.salary || 2500;
      const overtime_pay = attByUser[e.id]?.overtimePay ?? 0;
      const net_pay = parseFloat((base_salary + overtime_pay - deductions).toFixed(2));
      return {
        user_id: e.id, period: PERIOD, base_salary, deductions, bonuses: 0,
        manual_adj: 0, net_pay, status: 'Approved',
        overtime_pay, custom_items: [],
        period_start: PERIOD_START, period_end: PERIOD_END,
      };
    });
    const { data, error } = await dbOp('payrolls', 'insert', newPayrolls);
    if (error) showToast(`Error: ${error}`);
    else if (data) { setPayrolls([...data, ...payrolls]); showToast('Payroll processed'); }
    setIsProcessing(false);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditBase(String(item.base));
    setEditBonus(String(item.slip?.bonuses ?? 0));
    setEditAdj(String(item.slip?.manual_adj ?? 0));
    setEditNotes(item.slip?.deduction_notes ?? '');
    setEditOvertimePay(String(item.slip?.overtime_pay ?? item.overtimePay ?? item.att.overtimePay ?? 0));
    const raw: CustomItem[] = item.slip?.custom_items ?? [];
    setEditCustomItems(raw.map(ci => ({ ...ci, amount: String(ci.amount) })));
  };

  const addCustomItem = () =>
    setEditCustomItems(prev => [...prev, { id: crypto.randomUUID(), description: '', amount: '0', type: 'addition' }]);

  const updateCustomItem = (idx: number, patch: Partial<EditCustomItem>) =>
    setEditCustomItems(prev => prev.map((ci, i) => i === idx ? { ...ci, ...patch } : ci));

  const removeCustomItem = (idx: number) =>
    setEditCustomItems(prev => prev.filter((_, i) => i !== idx));

  const handleEditSave = async () => {
    if (!editItem) return;
    setEditSaving(true);
    const base        = parseFloat(editBase)       || editItem.base;
    const bonus       = parseFloat(editBonus)      || 0;
    const adj         = parseFloat(editAdj)        || 0;
    const overtimePay = parseFloat(editOvertimePay) || 0;
    const autoDeductions  = getAutoDeductions(editItem.emp.id);
    const totalDeductions = parseFloat((autoDeductions - adj).toFixed(2));
    const savedCustomItems: CustomItem[] = editCustomItems.map(ci => ({
      id: ci.id, description: ci.description,
      amount: parseFloat(ci.amount) || 0, type: ci.type,
    }));
    const customNet = getCustomItemsNet(savedCustomItems);
    const net = parseFloat((base + bonus + overtimePay - Math.max(0, totalDeductions) + customNet).toFixed(2));

    const patch = {
      base_salary: base, bonuses: bonus, manual_adj: adj, overtime_pay: overtimePay,
      deductions: Math.max(0, totalDeductions), net_pay: net,
      deduction_notes: editNotes, status: 'Approved', custom_items: savedCustomItems,
      period_start: PERIOD_START, period_end: PERIOD_END,
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
      user_id: emp.id, title: subject, subject,
      content: `Your payslip for ${PERIOD} is ready. Net pay: ${fmt(item.net, emp.currency)}. Please review and sign below.`,
      type: 'Payslip', sender: 'Finance / Management', sender_id: currentUserId,
      submitted_by_name: 'Finance / Management', requires_signature: true, is_read: false,
      html_content: html, doc_ref_type: 'payslip', doc_ref_id: String(item.slip?.id ?? emp.id),
    });
    if (error) showToast(`Send failed: ${error}`);
    else { setSent(prev => new Set([...prev, emp.id])); showToast(`Payslip sent to ${emp.name.split(' ')[0]}`); }
    setSending(null);
  };

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
            <div className="stat-v">{totalPayroll.toLocaleString()}</div>
            <div className="stat-foot">{PERIOD}</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className="stat-ico er">↓</div></div>
            <div className="stat-l">TOTAL DEDUCTIONS</div>
            <div className="stat-v" style={{ color: 'var(--err)' }}>{totalDeductions.toLocaleString()}</div>
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

        {/* Main payroll table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div>
              <div className="card-title">Payroll · {PERIOD}</div>
              <div className="card-sub">{fmtDateRange(PERIOD_START, PERIOD_END)} · OT rate: 200/hr per employee default</div>
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
                  <th>Hours (Normal / OT)</th>
                  <th>Base Salary</th>
                  <th>OT Pay</th>
                  <th>Deductions</th>
                  <th>Bonus / Other</th>
                  <th>Net Pay</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentPeriodList.map(item => {
                  const hue = ((item.emp.name || 'U').charCodeAt(0) * 13) % 360;
                  const empViolations = violationsByUser[item.emp.id] ?? [];
                  const customAdditions = item.customItems.filter(ci => ci.type === 'addition');
                  const customDeductions = item.customItems.filter(ci => ci.type === 'deduction');
                  const cur = item.emp.currency || 'USD';
                  return (
                    <tr key={item.emp.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="av-circle" style={{ width: 30, height: 30, fontSize: 10, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                            {item.emp.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
                          </div>
                          <div>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontWeight: 600, padding: 0, fontSize: 13, textAlign: 'left' }}
                              onClick={() => setHistoryEmp(item.emp)}
                              title="View pay history"
                            >
                              {item.emp.name}
                            </button>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                              {item.emp.role} · {cur}
                              {item.isInTraining && <span className="bdg bdg-warn" style={{ fontSize: 9, marginLeft: 5 }}>Training</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>
                        <div>{Math.floor(item.att.normalMins / 60)}h norm</div>
                        <div style={{ color: item.att.overtimeMins > 0 ? 'var(--acc)' : 'var(--ink-4)', fontWeight: item.att.overtimeMins > 0 ? 600 : 400 }}>
                          {Math.floor(item.att.overtimeMins / 60)}h OT
                        </div>
                        <div style={{ color: 'var(--ink-4)', fontSize: 10 }}>{item.att.daysPresent}d present</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmt(item.base, cur)}</td>
                      <td>
                        {item.overtimePay > 0
                          ? <span style={{ color: 'var(--acc)', fontWeight: 600 }}>+{fmt(item.overtimePay, cur)}</span>
                          : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </td>
                      <td>
                        {empViolations.length > 0 ? (
                          <div>
                            {empViolations.slice(0, 2).map((v: any, i: number) => (
                              <div key={i} style={{ fontSize: 11, color: 'var(--err)', whiteSpace: 'nowrap' }}>
                                {(v.rule_name ?? 'Violation')?.slice(0, 18)} −{fmt(v.salary_deducted ?? 0, cur)}
                              </div>
                            ))}
                            {empViolations.length > 2 && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>+{empViolations.length - 2} more</div>}
                            <div style={{ fontWeight: 600, color: 'var(--err)', fontSize: 12 }}>= −{fmt(item.deductions, cur)}</div>
                          </div>
                        ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 11 }}>
                        {item.bonuses > 0 && <div style={{ color: 'var(--ok)' }}>+{fmt(item.bonuses, cur)} bonus</div>}
                        {customAdditions.map((ci, i) => <div key={i} style={{ color: 'var(--ok)' }}>+{fmt(ci.amount, cur)} {ci.description?.slice(0, 12)}</div>)}
                        {customDeductions.map((ci, i) => <div key={i} style={{ color: 'var(--err)' }}>−{fmt(ci.amount, cur)} {ci.description?.slice(0, 12)}</div>)}
                        {item.bonuses === 0 && item.customItems.length === 0 && <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 14, color: 'var(--ok)' }}>{fmt(item.net, cur)}</td>
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
                              <button className="btn btn-acc btn-sm"
                                disabled={sending === item.emp.id || sent.has(item.emp.id)}
                                onClick={() => handleSendToInbox(item.emp, item)}>
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

      {/* Pay History Modal */}
      {historyEmp && (() => {
        const cur = historyEmp.currency || 'USD';
        const empPayrolls = payrolls
          .filter(p => p.user_id === historyEmp.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return (
          <div className="mb" onClick={e => { if (e.target === e.currentTarget) setHistoryEmp(null); }}>
            <div className="md" style={{ width: 680, maxHeight: '88vh', overflowY: 'auto' }}>
              <div className="md-t">Pay History — {historyEmp.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>
                {historyEmp.role} · {cur} · {empPayrolls.length} payroll{empPayrolls.length !== 1 ? 's' : ''} on record
              </div>

              {empPayrolls.length === 0 && (
                <div style={{ color: 'var(--ink-4)', padding: '20px 0', textAlign: 'center' }}>No payrolls on record yet.</div>
              )}

              {empPayrolls.map((p, idx) => {
                const customItems: CustomItem[] = p.custom_items ?? [];
                const customNet = getCustomItemsNet(customItems);
                const otPay = p.overtime_pay ?? 0;
                const periodRange = fmtDateRange(p.period_start, p.period_end);
                return (
                  <div key={p.id} style={{
                    border: '1px solid var(--line)', borderRadius: 10, padding: '14px 16px',
                    marginBottom: 10, background: idx === 0 ? 'var(--surface-2)' : 'var(--surface)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          #{empPayrolls.length - idx} &nbsp;·&nbsp; {p.period}
                        </div>
                        {periodRange && (
                          <div style={{ fontSize: 11, color: 'var(--acc)', fontWeight: 600, marginTop: 2 }}>{periodRange}</div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                          Created {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--ok)' }}>{fmt(p.net_pay, cur)}</div>
                        <span className={`bdg ${p.status === 'Approved' || p.status === 'Paid' ? 'bdg-ok' : 'bdg-warn'}`}>{p.status}</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12 }}>
                      <div>
                        <div style={{ color: 'var(--ink-4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Base</div>
                        <div style={{ fontWeight: 600 }}>{fmt(p.base_salary, cur)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--ink-4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>OT Pay</div>
                        <div style={{ fontWeight: 600, color: otPay > 0 ? 'var(--acc)' : 'var(--ink-3)' }}>
                          {otPay > 0 ? `+${fmt(otPay, cur)}` : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--ink-4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Deductions</div>
                        <div style={{ fontWeight: 600, color: p.deductions > 0 ? 'var(--err)' : 'var(--ink-3)' }}>
                          {p.deductions > 0 ? `−${fmt(p.deductions, cur)}` : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--ink-4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Bonus</div>
                        <div style={{ fontWeight: 600, color: p.bonuses > 0 ? 'var(--ok)' : 'var(--ink-3)' }}>
                          {p.bonuses > 0 ? `+${fmt(p.bonuses, cur)}` : '—'}
                        </div>
                      </div>
                    </div>

                    {(customItems.length > 0 || p.deduction_notes) && (
                      <div style={{ marginTop: 10, borderTop: '1px solid var(--line-2)', paddingTop: 10 }}>
                        {customItems.map((ci, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-3)' }}>
                            <span>{ci.description || 'Custom item'}</span>
                            <span style={{ color: ci.type === 'addition' ? 'var(--ok)' : 'var(--err)' }}>
                              {ci.type === 'addition' ? '+' : '−'}{fmt(ci.amount, cur)}
                            </span>
                          </div>
                        ))}
                        {p.deduction_notes && (
                          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>Note: {p.deduction_notes}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <button className="btn btn-sec" onClick={() => setHistoryEmp(null)}>Close</button>
            </div>
          </div>
        );
      })()}

      {/* Edit payslip modal */}
      {editItem && (() => {
        const empViolations = violationsByUser[editItem.emp.id] ?? [];
        const autoDeductions = getAutoDeductions(editItem.emp.id);
        const adjVal    = parseFloat(editAdj)         || 0;
        const bonusVal  = parseFloat(editBonus)       || 0;
        const baseVal   = parseFloat(editBase)        || editItem.base;
        const otVal     = parseFloat(editOvertimePay) || 0;
        const savedCustomItems = editCustomItems.map(ci => ({ ...ci, amount: parseFloat(ci.amount) || 0 }));
        const customNet = getCustomItemsNet(savedCustomItems as CustomItem[]);
        const previewNet = parseFloat((baseVal + bonusVal + otVal - Math.max(0, autoDeductions - adjVal) + customNet).toFixed(2));
        const att = editItem.att ?? { normalMins: 0, overtimeMins: 0, totalMins: 0 };
        const cur = editItem.emp.currency || 'USD';
        const payDates = getPayDates(editItem.emp.first_pay_date, 4);
        return (
          <div className="mb" onClick={e => { if (e.target === e.currentTarget) setEditItem(null); }}>
            <div className="md" style={{ width: 620, maxHeight: '88vh', overflowY: 'auto' }}>
              <div className="md-t">Edit Payslip — {editItem.emp.name}</div>

              {/* Pay schedule */}
              <div style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginBottom: 8 }}>PAY SCHEDULE · {cur}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: payDates.length ? 10 : 0 }}>
                  {[['Start', fmtDate(editItem.emp.start_date)], ['Training Until', fmtDate(editItem.emp.training_end_date)], ['First Pay', fmtDate(editItem.emp.first_pay_date)]].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {payDates.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {payDates.map((d, i) => (
                      <div key={i} style={{
                        padding: '3px 9px', borderRadius: 6, fontSize: 11,
                        fontWeight: i === 0 ? 700 : 400,
                        background: i === 0 ? 'var(--acc)' : 'var(--surface)',
                        color: i === 0 ? '#fff' : 'var(--ink-3)',
                        border: `1px solid ${i === 0 ? 'transparent' : 'var(--line)'}`,
                      }}>
                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {i === 0 && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.8 }}>next</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hours worked + overtime */}
              <div style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginBottom: 10 }}>HOURS WORKED · CURRENT PERIOD</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', marginBottom: 2 }}>Normal (≤40 h/wk)</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{fmtH(att.normalMins)}</div>
                  </div>
                  <div style={{ textAlign: 'center', borderLeft: '1px solid var(--line-2)', borderRight: '1px solid var(--line-2)' }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', marginBottom: 2 }}>Overtime (&gt;40 h/wk)</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: att.overtimeMins > 0 ? 'var(--acc)' : 'var(--ink-3)' }}>
                      {fmtH(att.overtimeMins)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', marginBottom: 2 }}>Total</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{fmtH(att.totalMins)}</div>
                  </div>
                </div>
                {att.overtimeMins > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--acc)', background: 'var(--surface)', borderRadius: 6, padding: '6px 10px' }}>
                    Auto OT pay: {fmtH(att.overtimeMins)} × {fmt(editItem.emp.overtime_rate ?? 200, cur)}/hr = <strong>{fmt(att.overtimePay ?? 0, cur)}</strong>
                  </div>
                )}
              </div>

              {/* Violations breakdown */}
              {empViolations.length > 0 && (
                <div style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginBottom: 8 }}>AUTO DEDUCTIONS FROM VIOLATIONS</div>
                  {empViolations.map((v: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: i < empViolations.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
                      <div>
                        <span style={{ fontWeight: 500 }}>{v.rule_name ?? 'Violation'}</span>
                        {v.explanation && <span style={{ color: 'var(--ink-4)', marginLeft: 8, fontSize: 11 }}>{v.explanation}</span>}
                        <span style={{ color: 'var(--ink-4)', marginLeft: 8 }}>
                          {new Date(v.triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <span style={{ color: 'var(--err)', fontFamily: 'var(--mono)' }}>−{fmt(v.salary_deducted ?? 0, cur)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, paddingTop: 8 }}>
                    <span>Total auto deductions</span>
                    <span style={{ color: 'var(--err)' }}>−{fmt(autoDeductions, cur)}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="pv-fld">
                  <label>Base Salary ({cur})</label>
                  <input className="fld-input mono" type="number" min="0" value={editBase} onChange={e => setEditBase(e.target.value)} />
                </div>
                <div className="pv-fld">
                  <label>Overtime Pay ({cur}) <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>— auto-calculated, override here</span></label>
                  <input className="fld-input mono" type="number" min="0" value={editOvertimePay} onChange={e => setEditOvertimePay(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="pv-fld">
                  <label>Bonus ({cur})</label>
                  <input className="fld-input mono" type="number" min="0" value={editBonus} onChange={e => setEditBonus(e.target.value)} placeholder="0" />
                </div>
                <div className="pv-fld">
                  <label>Deduction adjustment ({cur}) <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>+ = reduce</span></label>
                  <input className="fld-input mono" type="number" value={editAdj} onChange={e => setEditAdj(e.target.value)} placeholder="0" />
                </div>
              </div>

              <div className="pv-fld">
                <label>Notes for employee</label>
                <textarea className="fld-input" rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  placeholder="e.g. Deduction waived for approved leave" style={{ resize: 'vertical' }} />
              </div>

              {/* Custom line items */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Custom Line Items <span style={{ color: 'var(--ink-4)', fontWeight: 400, fontSize: 12 }}>— allowances, advances, other</span></div>
                  <button className="btn btn-sec btn-sm" onClick={addCustomItem}>+ Add Item</button>
                </div>
                {editCustomItems.length === 0 && <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No custom items.</div>}
                {editCustomItems.map((ci, idx) => (
                  <div key={ci.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input className="fld-input" placeholder="Description" value={ci.description} onChange={e => updateCustomItem(idx, { description: e.target.value })} />
                    <input className="fld-input mono" type="number" min="0" value={ci.amount} onChange={e => updateCustomItem(idx, { amount: e.target.value })} />
                    <select className="fld-input" value={ci.type} onChange={e => updateCustomItem(idx, { type: e.target.value as 'addition' | 'deduction' })}>
                      <option value="addition">+ Addition</option>
                      <option value="deduction">− Deduction</option>
                    </select>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--err)', padding: '0 8px' }} onClick={() => removeCustomItem(idx)}>✕</button>
                  </div>
                ))}
              </div>

              {/* Net preview */}
              <div style={{ background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 9, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginBottom: 10 }}>NET PAY PREVIEW ({cur})</div>
                {[
                  ['Base salary', fmt(baseVal, cur), ''],
                  otVal > 0 ? ['Overtime pay', `+${fmt(otVal, cur)}`, 'var(--acc)'] : null,
                  bonusVal > 0 ? ['Bonus', `+${fmt(bonusVal, cur)}`, 'var(--ok)'] : null,
                  ...savedCustomItems.map(ci => [(ci as any).description || 'Custom', `${(ci as any).type === 'addition' ? '+' : '−'}${fmt((ci as any).amount, cur)}`, (ci as any).type === 'addition' ? 'var(--ok)' : 'var(--err)']),
                  ['Deductions', `−${fmt(Math.max(0, autoDeductions - adjVal), cur)}`, 'var(--err)'],
                ].filter(Boolean).map((row: any, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--ink-3)' }}>{row[0]}</span>
                    <span style={{ color: row[2] || undefined }}>{row[1]}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, paddingTop: 8, borderTop: '1px solid var(--line-2)' }}>
                  <span>Net Pay</span>
                  <span style={{ color: 'var(--ok)' }}>{fmt(previewNet, cur)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-acc" onClick={handleEditSave} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save & Approve'}</button>
                <button className="btn btn-sec" onClick={() => setEditItem(null)}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Print / PDF payslip */}
      {printSlip && (() => {
        const empViolations = violationsByUser[printSlip.emp.id] ?? [];
        const att = printSlip.att ?? { normalMins: 0, overtimeMins: 0, totalMins: 0, daysPresent: 0, daysLate: 0 };
        const customItems: CustomItem[] = printSlip.slip?.custom_items ?? [];
        const cur = printSlip.emp.currency || 'USD';
        const payDates = getPayDates(printSlip.emp.first_pay_date, 4);
        const otPay = printSlip.slip?.overtime_pay ?? printSlip.overtimePay ?? 0;
        const periodRange = fmtDateRange(printSlip.slip?.period_start, printSlip.slip?.period_end);
        return (
          <div className="print-container" style={{ background: '#fff', padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ borderBottom: '2px solid oklch(0.52 0.20 268)', paddingBottom: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '10px', background: 'linear-gradient(135deg, oklch(0.52 0.20 268), oklch(0.42 0.22 280))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '20px' }}>PV</div>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>Pioneers Veneers</div>
                  <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Official Payslip Document</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Period: {PERIOD}</div>
                {periodRange && <div style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 600 }}>{periodRange}</div>}
                <div style={{ fontSize: '12px', color: '#64748b' }}>Generated: {new Date().toLocaleDateString()}</div>
              </div>
            </div>

            {(printSlip.emp.start_date || payDates.length > 0) && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Pay Schedule · Bi-weekly · {cur}</div>
                <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: '#475569', marginBottom: payDates.length ? '10px' : '0' }}>
                  {printSlip.emp.start_date && <span><strong>Start:</strong> {fmtDate(printSlip.emp.start_date)}</span>}
                  {printSlip.emp.training_end_date && <span><strong>Training until:</strong> {fmtDate(printSlip.emp.training_end_date)}</span>}
                  {printSlip.emp.first_pay_date && <span><strong>First pay:</strong> {fmtDate(printSlip.emp.first_pay_date)}</span>}
                </div>
                {payDates.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {payDates.map((d, i) => (
                      <div key={i} style={{ padding: '3px 10px', borderRadius: '5px', fontSize: '11px', background: i === 0 ? '#4f46e5' : '#f1f5f9', color: i === 0 ? '#fff' : '#475569', fontWeight: i === 0 ? 700 : 400 }}>
                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{i === 0 ? ' ← next' : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>Employee</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{printSlip.emp.name}</div>
                <div style={{ fontSize: '13px', color: '#475569' }}>{printSlip.emp.role}{printSlip.emp.department ? ` · ${printSlip.emp.department}` : ''}</div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '8px', lineHeight: 1.8 }}>
                  Days present: {att.daysPresent}<br />
                  Normal time: {fmtH(att.normalMins)}<br />
                  Overtime (&gt;40 h/wk): {fmtH(att.overtimeMins)}<br />
                  Total tracked: {fmtH(att.totalMins)}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '10px' }}>Payment Summary ({cur})</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: '#475569' }}>Base Salary</span><span style={{ fontWeight: 600 }}>{fmt(printSlip.base, cur)}</span>
                </div>
                {otPay > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#475569' }}>Overtime Pay ({fmtH(att.overtimeMins)})</span>
                    <span style={{ fontWeight: 600, color: '#6366f1' }}>+{fmt(otPay, cur)}</span>
                  </div>
                )}
                {(printSlip.bonuses ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#475569' }}>Bonus</span><span style={{ fontWeight: 600, color: '#10b981' }}>+{fmt(printSlip.bonuses, cur)}</span>
                  </div>
                )}
                {customItems.map((ci, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#475569' }}>{ci.description || 'Custom item'}</span>
                    <span style={{ fontWeight: 600, color: ci.type === 'addition' ? '#10b981' : '#ef4444' }}>
                      {ci.type === 'addition' ? '+' : '−'}{fmt(ci.amount, cur)}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', fontSize: '13px' }}>
                  <span style={{ color: '#ef4444' }}>Total Deductions</span>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>−{fmt(printSlip.deductions, cur)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>Net Pay</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>{fmt(printSlip.net, cur)}</span>
                </div>
              </div>
            </div>

            {empViolations.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '10px' }}>Deduction Detail</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Rule', 'Reason', 'Date', 'Points', 'Amount'].map((h, i) => (
                        <th key={h} style={{ textAlign: i >= 3 ? 'right' : 'left', padding: '8px 10px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {empViolations.map((v: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 500 }}>{v.rule_name ?? '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#64748b', maxWidth: 220 }}>{v.explanation ?? '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{new Date(v.triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#ef4444' }}>−{v.points_deducted}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>−{fmt(v.salary_deducted ?? 0, cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#fff7f7' }}>
                      <td colSpan={4} style={{ padding: '8px 10px', fontWeight: 700, fontSize: '13px' }}>Total Deductions</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#ef4444', fontSize: '13px' }}>−{fmt(printSlip.deductions, cur)}</td>
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

      {toast && <div className="tst">{toast}</div>}
    </>
  );
}
