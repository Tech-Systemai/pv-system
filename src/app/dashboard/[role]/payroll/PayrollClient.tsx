'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const PERIOD = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

export default function PayrollClient({
  employees,
  initialPayrolls,
  attendanceLogs,
}: {
  employees: any[];
  initialPayrolls: any[];
  attendanceLogs: any[];
}) {
  const [payrolls, setPayrolls] = useState(initialPayrolls);
  const [isProcessing, setIsProcessing] = useState(false);
  const [printSlip, setPrintSlip] = useState<any>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  // Build per-employee attendance stats from logs
  const attendanceByUser: Record<string, { totalMins: number; daysPresent: number; daysLate: number }> = {};
  for (const log of attendanceLogs) {
    if (!attendanceByUser[log.user_id]) attendanceByUser[log.user_id] = { totalMins: 0, daysPresent: 0, daysLate: 0 };
    attendanceByUser[log.user_id].totalMins += log.productive_time_minutes ?? 0;
    if (log.clock_in_time) attendanceByUser[log.user_id].daysPresent++;
    if (log.status === 'late') attendanceByUser[log.user_id].daysLate++;
  }

  const handleProcessAll = async () => {
    if (!confirm(`Process payroll for ${PERIOD}? This will create approved payslips for all employees.`)) return;
    setIsProcessing(true);

    const newPayrolls = employees.map(e => {
      const deductions = e.points < 7 ? (7 - e.points) * 20 : 0;
      const base_salary = e.salary || 2500;
      const net_pay = base_salary - deductions;
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
    const deductions = slip ? slip.deductions : (e.points < 7 ? (7 - e.points) * 20 : 0);
    const base = slip ? slip.base_salary : (e.salary || 2500);
    const net = slip ? slip.net_pay : base - deductions;
    const isApproved = slip?.status === 'Approved';
    const att = attendanceByUser[e.id] ?? { totalMins: 0, daysPresent: 0, daysLate: 0 };
    return { emp: e, base, deductions, net, isApproved, slip, att };
  });

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

      <div className="pn-h no-print" style={{ marginBottom: '14px' }}>
        <div>
          <div className="pn-t">Payroll · {PERIOD}</div>
          <div style={{ fontSize: '12px', color: '#6b7689', marginTop: '2px' }}>
            Deductions = (7 − points) × $20 · Nightly policy engine applies penalties
          </div>
        </div>
        <button className="pv-btn pv-btn-pri" onClick={handleProcessAll} disabled={isProcessing}>
          {isProcessing ? 'Processing...' : 'Process & Approve All →'}
        </button>
      </div>

      <div className="pn no-print">
        {currentPeriodList.length === 0 && <div className="empty">No employees found.</div>}
        {currentPeriodList.map(item => (
          <div key={item.emp.id} className="r-cd" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <div className="av gy">{item.emp.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}</div>

            <div style={{ flex: 1, minWidth: '140px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.emp.name}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>{item.emp.department} · {item.emp.id.substring(0, 8)}</div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                {item.att.daysPresent}d present · {item.att.daysLate}d late · {Math.floor(item.att.totalMins / 60)}h tracked
              </div>
            </div>

            <div style={{ textAlign: 'right', minWidth: '70px' }}>
              <div style={{ fontSize: '9.5px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 600 }}>Base</div>
              <div style={{ fontWeight: 600 }}>${item.base.toLocaleString()}</div>
            </div>

            {item.deductions > 0 && (
              <div style={{ textAlign: 'right', minWidth: '70px' }}>
                <div style={{ fontSize: '9.5px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 600 }}>Deduct</div>
                <div style={{ color: '#dc2626', fontWeight: 600 }}>−${item.deductions.toLocaleString()}</div>
              </div>
            )}

            <div style={{ textAlign: 'right', minWidth: '90px' }}>
              <div style={{ fontSize: '9.5px', color: '#047857', textTransform: 'uppercase', fontWeight: 600 }}>Net Pay</div>
              <div style={{ color: '#047857', fontWeight: 700, fontSize: '14px' }}>${item.net.toLocaleString()}</div>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {item.isApproved ? (
                <>
                  <button className="pv-btn pv-btn-sec" onClick={() => setPrintSlip(item)}>↓ PDF</button>
                  <button
                    className="pv-btn pv-btn-pri"
                    disabled={sending === item.emp.id || sent.has(item.emp.id)}
                    onClick={() => handleSendToInbox(item.emp, item)}
                    style={{ fontSize: '11px' }}
                  >
                    {sent.has(item.emp.id) ? '✓ Sent' : sending === item.emp.id ? '...' : '✉ Send'}
                  </button>
                </>
              ) : (
                <span className="pv-bdg pv-bdg-amber">Draft</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {printSlip && (
        <div className="print-container" style={{ background: '#fff', padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ borderBottom: '2px solid #4f46e5', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '20px' }}>PV</div>
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
            <button className="pv-btn pv-btn-pri" onClick={() => window.print()}>🖨️ Print / Download PDF</button>
            <button className="pv-btn pv-btn-sec" onClick={() => setPrintSlip(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
