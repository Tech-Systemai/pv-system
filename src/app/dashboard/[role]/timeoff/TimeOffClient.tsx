'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function TimeOffClient({ 
  initialRequests, 
  isMgmt, 
  currentUserId,
  currentUserName
}: { 
  initialRequests: any[], 
  isMgmt: boolean, 
  currentUserId: string,
  currentUserName: string
}) {
  const [requests, setRequests] = useState(initialRequests);
  const supabase = createClient();

  const handleAction = async (id: string, newStatus: string) => {
    await supabase.from('time_off_requests').update({ status: newStatus }).eq('id', id);
    setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newReq = {
      user_id: currentUserId,
      start_date: formData.get('from'),
      end_date: formData.get('to'),
      type: formData.get('type'),
      reason: formData.get('reason'),
      status: 'Pending'
    };

    const { data } = await supabase.from('time_off_requests').insert([newReq]).select(`*, profiles:user_id(name)`);
    if (data && data[0]) {
      setRequests([data[0], ...requests]);
    }
    
    // reset form
    (e.target as HTMLFormElement).reset();
  };

  if (isMgmt) {
    return (
      <>
        <div className="three" style={{ marginBottom: '18px' }}>
          <div className="stat">
            <div className="s-l">Pending</div>
            <div className="s-v" style={{ color: '#b45309' }}>{requests.filter(t => t.status === 'Pending').length}</div>
          </div>
          <div className="stat">
            <div className="s-l">Approved</div>
            <div className="s-v gn">{requests.filter(t => t.status === 'Approved').length}</div>
          </div>
          <div className="stat">
            <div className="s-l">Rejected</div>
            <div className="s-v rd">{requests.filter(t => t.status === 'Rejected').length}</div>
          </div>
        </div>
        
        <div className="pn">
          {requests.length === 0 && <div className="empty">No requests found.</div>}
          {requests.map(t => (
            <div key={t.id} className="pv-row-card">
              <div className="sb-av" style={{ background: '#f0f2f5', color: '#6b7689' }}>
                {t.profiles?.name ? t.profiles.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2) : 'U'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.profiles?.name || 'Unknown User'}</div>
                <div style={{ fontSize: '11px', color: '#6b7689' }}>{t.start_date} → {t.end_date} · {t.reason}</div>
                <div style={{ fontSize: '10px', color: '#9fa8be', marginTop: '2px' }}>Submitted {new Date(t.created_at).toLocaleDateString()}</div>
              </div>
              
              <span className={`pv-bdg ${t.status === 'Approved' ? 'pv-bdg-green' : t.status === 'Rejected' ? 'pv-bdg-red' : 'pv-bdg-amber'}`}>
                {t.status}
              </span>
              
              {t.status === 'Pending' && (
                <>
                  <button className="pv-btn" style={{ background: 'transparent', color: '#047857' }} onClick={() => handleAction(t.id, 'Approved')}>✓ Approve</button>
                  <button className="pv-btn" style={{ background: 'transparent', color: '#dc2626' }} onClick={() => handleAction(t.id, 'Rejected')}>× Reject</button>
                </>
              )}
            </div>
          ))}
        </div>
      </>
    );
  }

  // Employee View
  return (
    <>
      <div className="pn">
        <div className="pn-h"><div className="pn-t">Submit new request</div></div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div className="pv-fld"><label>From date</label><input type="date" name="from" required /></div>
            <div className="pv-fld"><label>To date</label><input type="date" name="to" required /></div>
            <div className="pv-fld">
              <label>Type</label>
              <select name="type">
                <option>Vacation</option>
                <option>Sick leave</option>
                <option>Personal</option>
                <option>Family</option>
              </select>
            </div>
          </div>
          <div className="pv-fld"><label>Reason</label><textarea name="reason" rows={2} required></textarea></div>
          <button type="submit" className="pv-btn pv-btn-pri">Submit request →</button>
        </form>
      </div>

      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '12px' }}>My requests</div>
        {requests.length ? requests.map(t => (
          <div key={t.id} className="pv-row-card">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{t.start_date} → {t.end_date}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>{t.reason}</div>
            </div>
            <span className={`pv-bdg ${t.status === 'Approved' ? 'pv-bdg-green' : t.status === 'Rejected' ? 'pv-bdg-red' : 'pv-bdg-amber'}`}>
              {t.status}
            </span>
          </div>
        )) : <div className="empty">No requests yet</div>}
      </div>
    </>
  );
}
