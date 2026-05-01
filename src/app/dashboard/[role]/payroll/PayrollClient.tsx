'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function PayrollClient({ employees, initialPayrolls }: { employees: any[], initialPayrolls: any[] }) {
  const [payrolls, setPayrolls] = useState(initialPayrolls);
  const [isProcessing, setIsProcessing] = useState(false);
  const [printSlip, setPrintSlip] = useState<any>(null);
  const supabase = createClient();

  const handleProcessAll = async () => {
    setIsProcessing(true);
    const period = 'April 2026';
    
    // Calculate payrolls
    const newPayrolls = employees.map(e => {
      // Logic from v3: deductions = (7 - points) * 20
      const deductions = e.points < 7 ? (7 - e.points) * 20 : 0;
      const base_salary = e.salary || 2500;
      const net_pay = base_salary - deductions;
      
      return {
        user_id: e.id,
        period,
        base_salary,
        deductions,
        bonuses: 0,
        net_pay,
        status: 'Approved'
      };
    });

    const { data } = await supabase.from('payrolls').insert(newPayrolls).select();
    if (data) {
      setPayrolls([...data, ...payrolls]);
      alert('Payroll processed and approved for all employees.');
    }
    setIsProcessing(false);
  };

  const handleDownloadPDF = (emp: any, slipData: any) => {
    setPrintSlip({ emp, slipData });
    setTimeout(() => {
      window.print();
    }, 500);
  };

  // Build a mapped list for UI
  const currentPeriodList = employees.map(e => {
    const slip = payrolls.find(p => p.user_id === e.id && p.period === 'April 2026');
    const deductions = slip ? slip.deductions : (e.points < 7 ? (7 - e.points) * 20 : 0);
    const base = slip ? slip.base_salary : (e.salary || 2500);
    const net = slip ? slip.net_pay : (base - deductions);
    const isApproved = slip?.status === 'Approved';

    return { emp: e, base, deductions, net, isApproved, slip };
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; box-sizing: border-box; }
          .no-print { display: none !important; }
        }
      `}} />

      <div className="pn-h no-print" style={{ marginBottom: '14px' }}>
        <div className="pn-t">Process payroll · April 2026</div>
        <button className="pv-btn pv-btn-pri" onClick={handleProcessAll} disabled={isProcessing}>
          {isProcessing ? 'Processing...' : 'Process & Approve All →'}
        </button>
      </div>

      <div className="pn no-print">
        {currentPeriodList.map(item => (
          <div key={item.emp.id} className="r-cd">
            <div className="av gy">{item.emp.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.emp.name}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>{item.emp.department} · {item.emp.id.substring(0,8)}</div>
            </div>
            
            <div style={{ textAlign: 'right', minWidth: '80px' }}>
              <div style={{ fontSize: '9.5px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 600 }}>Base</div>
              <div style={{ fontWeight: 600 }}>${item.base.toLocaleString()}</div>
            </div>
            
            {item.deductions > 0 && (
              <div style={{ textAlign: 'right', minWidth: '80px' }}>
                <div style={{ fontSize: '9.5px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 600 }}>Deduct</div>
                <div style={{ color: '#dc2626', fontWeight: 600 }}>-${item.deductions.toLocaleString()}</div>
              </div>
            )}
            
            <div style={{ textAlign: 'right', minWidth: '100px' }}>
              <div style={{ fontSize: '9.5px', color: '#047857', textTransform: 'uppercase', fontWeight: 600 }}>Net</div>
              <div style={{ color: '#047857', fontWeight: 700, fontSize: '14px' }}>${item.net.toLocaleString()}</div>
            </div>

            {item.isApproved ? (
              <button className="pv-btn pv-btn-sec" onClick={() => handleDownloadPDF(item.emp, item)}>↓ AI PDF</button>
            ) : (
              <span className="pv-bdg pv-bdg-amber">Draft</span>
            )}
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
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Official AI Payslip Document</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Period: April 2026</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Generated: {new Date().toLocaleDateString()}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Ref: PRY-{printSlip.slip.slip?.id?.substring(0,8) || 'DRAFT'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '40px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>Employee Details</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{printSlip.emp.name}</div>
              <div style={{ fontSize: '14px', color: '#475569' }}>{printSlip.emp.role} · {printSlip.emp.department}</div>
              <div style={{ fontSize: '14px', color: '#475569' }}>ID: {printSlip.emp.id.substring(0,12)}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>Payment Summary</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#475569' }}>Base Salary</span>
                <span style={{ fontWeight: 600 }}>${printSlip.slip.base.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                <span style={{ color: '#475569' }}>Deductions</span>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>-${printSlip.slip.deductions.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Net Pay</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>${printSlip.slip.net.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div style={{ background: '#eef2ff', padding: '20px', borderRadius: '12px', marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '20px' }}>✨</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#4338ca' }}>AI Performance Analysis</span>
            </div>
            <div style={{ fontSize: '13px', color: '#4f46e5', lineHeight: '1.6' }}>
              Based on the attendance and QA telemetry for April 2026, {printSlip.emp.name} has maintained a performance score of {printSlip.emp.score}/100 and a reliability rating of {printSlip.emp.points}/7 points.
              {printSlip.slip.deductions > 0 ? ` Note: Deductions were automatically applied due to missed reliability benchmarks per company policy.` : ` Excellent reliability recorded. No deductions applied.`}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
            This is an automatically generated document. Electronically signed by Pioneers Veneers Finance Department.
          </div>
          
          <div className="no-print" style={{ textAlign: 'center', marginTop: '30px' }}>
            <button className="pv-btn pv-btn-sec" onClick={() => setPrintSlip(null)}>Close Print Preview</button>
          </div>
        </div>
      )}
    </>
  );
}
