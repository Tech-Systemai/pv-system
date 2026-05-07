'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const PERIOD = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

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

  const attendanceByUser: Record<string, { totalMins: number; daysPresent: number; daysLate: number }> = {};
  for (const log of attendanceLogs) {
    if (!attendanceByUser[log.user_id]) attendanceByUser[log.user_id] = { totalMins: 0, daysPresent: 0, daysLate: 0 };
    attendanceByUser[log.user_id].totalMins += log.productive_time_minutes ?? 0;
    if (log.clock_in_time) attendanceByUser[log.user_id].daysPresent++;
    if (log.status === 'late') attendanceByUser[log.user_id].daysLate++;
  }

  // Sum actual salary deductions from violations this month per employee
  const violationDeductionByUser: Record<string, number> = {};
  for (const v of violations) {
    violationDeductionByUser[v.user_id] = parseFloat(
      ((violationDeductionByUser[v.user_id] ?? 0) + (v.salary_deducted ?? 0)).toFixed(2)
    );
  }

  const getDeductions = (emp: any): number => {
    // Use actual violation salary_deducted sum; fall back to 0 (never the old formula)
    return violationDeductionByUser[emp.id] ?? 0;
  };

  const handleProcessAll = async () => {
    if (!confirm(`Process payroll for ${PERIOD}? This will create approved payslips for all employees.`)) return;
    setIsProcessing(true);
    const newPayrolls = employees.map(e => {
      const deductions = getDeductions(e);
      const base_salary = e.salary || 2500;
      const net_pay = parseFloat((base_salary - deductions).toFixed(2));
      return { user_id: e.id, period: PERIOD, base_salary, deductions, bonuses: 0, net_pay, status: 'Approved' };
    });
    const { data } = await dbOp('payrolls', 'insert', newPayrolls);
    if (data) setPayrolls([...data, ...payrolls]);
    setIsProcessing(false);
  };

  const handleSendToInbox = async (emp: any, item: any) => {
    setSending(emp.id);
    const content = `Your payslip for ${PERIOD} is ready.\n\nBase Salary: $${item.base.toLocaleString()}\nDeductions: -$${item.deductions.toLocaleString()}\nNet Pay: $${item.net.toLocaleString()}\n\nPlease sign and acknowledge receipt.`;
    await dbOp('inbox_documents', 'insert', {
      user_id: emp.id,
      title: `Payslip — ${PERIOD}`,
      content,
      type: 'payslip',
      requires_signature: true,
    });
    setSent(prev => new Set([...prev, emp.id]));
    setSending(null);
  };

  const currentPeriodList = employees.map(e => {
    const slip = payrolls.find(p => p.user_id === e.id && p.period === PERIOD);
    const deductions = slip ? slip.deductions : getDeductions(e);
    const base = slip ? slip.base_salary : (e.salary || 2500);
    const net = slip ? slip.net_pay : parseFloat((base - deductions).toFixed(2));
    const isApproved = slip?.status === 'Approved';
    const att = attendanceByUser[e.id] ?? { totalMins: 0, daysPresent: 0, daysLate: 0 };
    return { emp: e, base, deductions, net, isApproved, slip, att };
  });

  const totalPayroll = currentPeriodList.reduce((s, i) => s + i.net, 0);
  const totalDeductions = currentPeriodList.reduce((s, i) => s + i.deductions, 0);
  const processedCount = currentPeriodList.filter(i => i.isApproved).length;
  const sentCount = sent.size;

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
            <div className="stat-foot">Points-based penalties</div>
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
            <div className="stat-v">{sentCount}</div>
            <div className="stat-foot">This session</div>
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div>
              <div className="card-title">Payroll · {PERIOD}</div>
              <div className="card-sub">Deductions pulled from policy violations this month · percentage-based</div>
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
                  <th>Deductions</th>
                  <th>Net Pay</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentPeriodList.map(item => {
                  const hue = ((item.emp.name || 'U').charCodeAt(0) * 13) % 360;
                  return (
                    <tr key={item.emp.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="av-circle" style={{ width: 32, height: 32, fontSize: 11, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                            {item.emp.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{item.emp.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{item.emp.department}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
                        {item.att.daysPresent}d · {item.att.daysLate}L · {Math.floor(item.att.totalMins / 60)}h
                      </td>
                      <td style={{ fontWeight: 600 }}>${item.base.toLocaleString()}</td>
                      <td>
                        {item.deductions > 0 ? (
                          <span style={{ color: 'var(--err)', fontWeight: 600 }}>−${item.deductions.toLocaleString()}</span>
                        ) : (
                          <span style={{ color: 'var(--ink-4)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 15, color: 'var(--ok)' }}>${item.net.toLocaleString()}</td>
                      <td>
                        {item.isApproved
                          ? <span className="bdg bdg-ok">Approved</span>
                          : <span className="bdg bdg-warn">Draft</span>}
                      </td>
                      <td>
                        {item.isApproved ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-sec btn-sm" onClick={() => setPrintSlip(item)}>↓ PDF</button>
                            <button
                              className="btn btn-acc btn-sm"
                              disabled={sending === item.emp.id || sent.has(item.emp.id)}
                              onClick={() => handleSendToInbox(item.emp, item)}
                            >
                              {sent.has(item.emp.id) ? '✓ Sent' : sending === item.emp.id ? '…' : '✉ Send'}
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>Process first</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Print / PDF payslip */}
      {printSlip && (
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '40px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>Employee</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{printSlip.emp.name}</div>
              <div style={{ fontSize: '13px', color: '#475569' }}>{printSlip.emp.role} · {printSlip.emp.department}</div>
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '8px' }}>
                Days present: {printSlip.att.daysPresent}<br />
                Days late: {printSlip.att.daysLate}<br />
                Tracked hours: {Math.floor(printSlip.att.totalMins / 60)}h {printSlip.att.totalMins % 60}m
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>Payment Summary</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#475569' }}>Base Salary</span>
                <span style={{ fontWeight: 600 }}>${printSlip.base.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                <span style={{ color: '#475569' }}>Deductions</span>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>−${printSlip.deductions.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 700 }}>Net Pay</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>${printSlip.net.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
            <div style={{ width: '40%' }}>
              <div style={{ fontWeight: 600, fontSize: '12px' }}>Finance Department</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Pioneers Veneers — Authorized Signature</div>
            </div>
            <div style={{ width: '40%', textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: '12px' }}>Employee Acknowledgement</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{printSlip.emp.name}</div>
            </div>
          </div>

          <div className="no-print" style={{ textAlign: 'center', marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button className="btn btn-acc" onClick={() => window.print()}>Print / Download PDF</button>
            <button className="btn btn-sec" onClick={() => setPrintSlip(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
