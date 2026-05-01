'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function ApprovalsClient({ initialTimeoff, initialSchedules, initialPayrolls }: { initialTimeoff: any[], initialSchedules: any[], initialPayrolls: any[] }) {
  const [timeoff, setTimeoff] = useState(initialTimeoff);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [payrolls, setPayrolls] = useState(initialPayrolls);
  const supabase = createClient();

  const handleAction = async (table: string, id: string, status: string, stateSetter: any, state: any[]) => {
    await supabase.from(table).update({ status }).eq('id', id);
    stateSetter(state.filter(item => item.id !== id));
  };

  const totalPending = timeoff.length + schedules.length + payrolls.length;

  return (
    <>
      <div className="pn-h" style={{ marginBottom: '16px' }}>
        <div>
          <div className="pn-t">Unified Approvals Queue</div>
          <div className="pn-s">{totalPending} items require your attention</div>
        </div>
      </div>

      <div className="three" style={{ marginBottom: '24px' }}>
        <div className="stat"><div className="s-l">Time-Off</div><div className="s-v am">{timeoff.length}</div></div>
        <div className="stat"><div className="s-l">Schedules</div><div className="s-v ind">{schedules.length}</div></div>
        <div className="stat"><div className="s-l">Payroll</div><div className="s-v gn">{payrolls.length}</div></div>
      </div>

      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '16px' }}>Time-Off Requests</div>
        {timeoff.length === 0 && <div className="empty">No pending time-off requests.</div>}
        {timeoff.map(t => (
          <div key={t.id} className="r-cd">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.profiles?.name} · {t.type}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>{t.start_date} to {t.end_date}</div>
            </div>
            <button className="pv-btn" style={{ background: 'transparent', color: '#047857' }} onClick={() => handleAction('time_off_requests', t.id, 'Approved', setTimeoff, timeoff)}>✓ Approve</button>
            <button className="pv-btn" style={{ background: 'transparent', color: '#dc2626' }} onClick={() => handleAction('time_off_requests', t.id, 'Rejected', setTimeoff, timeoff)}>× Reject</button>
          </div>
        ))}
      </div>

      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '16px' }}>Schedules</div>
        {schedules.length === 0 && <div className="empty">No pending schedules.</div>}
        {schedules.map(s => (
          <div key={s.id} className="r-cd">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.team} · {s.week}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>Affects {s.affects_count} employees</div>
            </div>
            <button className="pv-btn" style={{ background: 'transparent', color: '#047857' }} onClick={() => handleAction('schedules', s.id, 'Approved', setSchedules, schedules)}>✓ Approve</button>
            <button className="pv-btn" style={{ background: 'transparent', color: '#dc2626' }} onClick={() => handleAction('schedules', s.id, 'Rejected', setSchedules, schedules)}>× Reject</button>
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
              <div style={{ fontSize: '11px', color: '#6b7689' }}>Net Pay: ${p.net_pay} (Base: ${p.base_salary})</div>
            </div>
            <button className="pv-btn" style={{ background: 'transparent', color: '#047857' }} onClick={() => handleAction('payrolls', p.id, 'Approved', setPayrolls, payrolls)}>✓ Approve</button>
            <button className="pv-btn" style={{ background: 'transparent', color: '#dc2626' }} onClick={() => handleAction('payrolls', p.id, 'Rejected', setPayrolls, payrolls)}>× Reject</button>
          </div>
        ))}
      </div>
    </>
  );
}
