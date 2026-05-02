'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

export default function ApprovalsClient({ initialTimeoff, initialSchedules, initialPayrolls }: { initialTimeoff: any[], initialSchedules: any[], initialPayrolls: any[] }) {
  const [timeoff, setTimeoff] = useState(initialTimeoff);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [payrolls, setPayrolls] = useState(initialPayrolls);
  const [busy, setBusy] = useState<string | null>(null);

  const handleAction = async (table: string, id: string, status: string, stateSetter: React.Dispatch<React.SetStateAction<any[]>>) => {
    setBusy(id);
    await dbOp(table, 'update', { status }, { id });
    stateSetter(prev => prev.filter(item => item.id !== id));
    setBusy(null);
  };

  const totalPending = timeoff.length + schedules.length + payrolls.length;

  return (
    <>
      <div className="pn-h" style={{ marginBottom: '16px' }}>
        <div>
          <div className="pn-t">Unified Approvals Queue</div>
          <div className="pn-s">{totalPending} item{totalPending !== 1 ? 's' : ''} require your attention</div>
        </div>
      </div>

      <div className="three" style={{ marginBottom: '24px' }}>
        <div className="stat"><div className="s-l">Time-Off</div><div className="s-v am">{timeoff.length}</div></div>
        <div className="stat"><div className="s-l">Schedules</div><div className="s-v ind">{schedules.length}</div></div>
        <div className="stat"><div className="s-l">Payroll</div><div className="s-v gn">{payrolls.length}</div></div>
      </div>

      <div className="pn" style={{ marginBottom: '20px' }}>
        <div className="pn-t" style={{ marginBottom: '16px' }}>Time-Off Requests</div>
        {timeoff.length === 0 && <div className="empty">No pending time-off requests.</div>}
        {timeoff.map(t => (
          <div key={t.id} className="r-cd">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.profiles?.name} · {t.type}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>{t.start_date} → {t.end_date}</div>
              {t.reason && <div style={{ fontSize: '11px', color: '#4a5568', marginTop: '2px' }}>Reason: {t.reason}</div>}
            </div>
            <button className="pv-btn" style={{ color: '#047857' }} disabled={busy === t.id} onClick={() => handleAction('time_off_requests', t.id, 'Approved', setTimeoff)}>✓ Approve</button>
            <button className="pv-btn" style={{ color: '#dc2626' }} disabled={busy === t.id} onClick={() => handleAction('time_off_requests', t.id, 'Rejected', setTimeoff)}>× Reject</button>
          </div>
        ))}
      </div>

      <div className="pn" style={{ marginBottom: '20px' }}>
        <div className="pn-t" style={{ marginBottom: '16px' }}>Schedule Submissions</div>
        {schedules.length === 0 && <div className="empty">No pending schedules.</div>}
        {schedules.map(s => (
          <div key={s.id} className="r-cd">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.team || 'Schedule'} · {s.week || s.created_at?.split('T')[0]}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>Submitted for approval</div>
            </div>
            <button className="pv-btn" style={{ color: '#047857' }} disabled={busy === s.id} onClick={() => handleAction('schedules', s.id, 'Approved', setSchedules)}>✓ Approve</button>
            <button className="pv-btn" style={{ color: '#dc2626' }} disabled={busy === s.id} onClick={() => handleAction('schedules', s.id, 'Rejected', setSchedules)}>× Reject</button>
          </div>
        ))}
      </div>

      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '16px' }}>Payroll Drafts</div>
        {payrolls.length === 0 && <div className="empty">No pending payroll drafts.</div>}
        {payrolls.map(p => (
          <div key={p.id} className="r-cd">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.profiles?.name} · {p.period}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>Net Pay: ${Number(p.net_pay).toLocaleString()} (Base: ${Number(p.base_salary).toLocaleString()})</div>
            </div>
            <button className="pv-btn" style={{ color: '#047857' }} disabled={busy === p.id} onClick={() => handleAction('payrolls', p.id, 'Approved', setPayrolls)}>✓ Approve</button>
            <button className="pv-btn" style={{ color: '#dc2626' }} disabled={busy === p.id} onClick={() => handleAction('payrolls', p.id, 'Rejected', setPayrolls)}>× Reject</button>
          </div>
        ))}
      </div>
    </>
  );
}
