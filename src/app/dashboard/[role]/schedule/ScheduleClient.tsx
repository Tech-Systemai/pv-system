'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function ScheduleClient({ initialSchedules, users, isMgmt, currentUserId }: { initialSchedules: any[], users: any[], isMgmt: boolean, currentUserId: string }) {
  const [schedules, setSchedules] = useState(initialSchedules);
  const supabase = createClient();

  const handleApprove = async (id: string) => {
    await supabase.from('schedules').update({ status: 'Approved' }).eq('id', id);
    setSchedules(schedules.map(s => s.id === id ? { ...s, status: 'Approved' } : s));
  };

  const handleReject = async (id: string) => {
    await supabase.from('schedules').update({ status: 'Rejected' }).eq('id', id);
    setSchedules(schedules.map(s => s.id === id ? { ...s, status: 'Rejected' } : s));
  };

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <>
      {isMgmt && (
        <div className="pn">
          <div className="pn-h">
            <div>
              <div className="pn-t">Awaiting approval</div>
              <div className="pn-s" style={{ fontSize: '11px', color: '#6b7689', marginTop: '4px' }}>
                {schedules.filter(s => s.status === 'Pending').length} schedules pending
              </div>
            </div>
            <button className="pv-btn pv-btn-pri">+ Create schedule</button>
          </div>
          
          {schedules.filter(s => s.status === 'Pending').length === 0 && <div className="empty">No pending schedules.</div>}
          
          {schedules.filter(s => s.status === 'Pending').map(s => (
            <div key={s.id} className="r-cd">
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309', fontSize: '16px' }}>⏱</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.team} · {s.week}</div>
                <div style={{ fontSize: '11px', color: '#6b7689' }}>By System · {s.affects_count} employees</div>
              </div>
              <span className="pv-bdg pv-bdg-amber">Pending</span>
              <button className="pv-btn" style={{ background: 'transparent', color: '#047857' }} onClick={() => handleApprove(s.id)}>✓ Approve</button>
              <button className="pv-btn" style={{ background: 'transparent', color: '#dc2626' }} onClick={() => handleReject(s.id)}>× Reject</button>
            </div>
          ))}
        </div>
      )}

      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '14px' }}>Live grid · Current Week</div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '130px repeat(7, 1fr)', gap: '3px', minWidth: '560px' }}>
            <div></div>
            {days.map(d => (
              <div key={d} style={{ fontSize: '10.5px', textAlign: 'center', padding: '6px', fontWeight: 600, color: '#4a5568', textTransform: 'uppercase' }}>{d}</div>
            ))}
            
            {users.filter(u => u.role === 'sales' || u.role === 'cx' || u.id === currentUserId).map(e => (
              <React.Fragment key={e.id}>
                <div style={{ fontSize: '11.5px', color: '#1a1f2e', padding: '7px 5px', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
                  {e.name.split(' ')[0]}
                </div>
                {days.map(d => {
                  // Mock shifts (Monday-Friday)
                  const on = d !== 'Sat' && d !== 'Sun';
                  const bg = on ? (e.role === 'sales' ? '#fef3c7' : '#e0f2fe') : '#f5f6f8';
                  const cl = on ? (e.role === 'sales' ? '#b45309' : '#075985') : '#9fa8be';
                  
                  return (
                    <div key={`${e.id}-${d}`} style={{ 
                      height: '30px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      fontSize: '9.5px', fontWeight: 600, background: bg, color: cl 
                    }}>
                      {on ? (e.role === 'sales' ? 'OUT' : 'IN') : '—'}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
