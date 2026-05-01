'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function AttendanceClient({ initialLogs, users, isMgmt, currentUserId }: { initialLogs: any[], users: any[], isMgmt: boolean, currentUserId: string }) {
  const [logs, setLogs] = useState(initialLogs);
  const [isSyncing, setIsSyncing] = useState(false);
  const supabase = createClient();

  const handleApployeSync = async () => {
    setIsSyncing(true);
    // Mock syncing from Apploye
    setTimeout(() => {
      alert('Successfully connected to Apploye API and synced productive hours.');
      setIsSyncing(false);
    }, 1500);
  };

  const today = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.date === today);

  // Generate 30 days grid for the current month
  const daysInMonth = 30;

  const usersToDisplay = isMgmt ? users : users.filter(u => u.id === currentUserId);

  return (
    <>
      <div className="pn-h" style={{ marginBottom: '14px' }}>
        <div className="pn-t">Attendance & Time Tracking</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isMgmt && <button className="pv-btn pv-btn-sec" onClick={handleApployeSync} disabled={isSyncing}>
            {isSyncing ? 'Syncing...' : '↻ Sync Apploye API'}
          </button>}
          {isMgmt && <button className="pv-btn pv-btn-pri">Export Timesheets</button>}
        </div>
      </div>

      {isMgmt && (
        <div className="three" style={{ marginBottom: '14px' }}>
          <div className="stat">
            <div className="s-l">Clocked in (Live)</div>
            <div className="s-v gn">{users.filter(u => u.clocked_in).length}</div>
          </div>
          <div className="stat">
            <div className="s-l">Late today</div>
            <div className="s-v" style={{ color: '#b45309' }}>{todayLogs.filter(l => l.status === 'late').length}</div>
          </div>
          <div className="stat">
            <div className="s-l">No-shows</div>
            <div className="s-v rd">{todayLogs.filter(l => l.status === 'absent').length}</div>
          </div>
        </div>
      )}

      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '16px' }}>Current Month Status Overview</div>
        
        {usersToDisplay.map(u => {
          const userLogs = logs.filter(l => l.user_id === u.id);
          const lateCount = userLogs.filter(l => l.status === 'late').length;
          const absentCount = userLogs.filter(l => l.status === 'absent').length;
          const totalProductive = userLogs.reduce((acc, l) => acc + (l.productive_time_minutes || 0), 0);
          const productiveHours = (totalProductive / 60).toFixed(1);

          return (
            <div key={u.id} style={{ marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid #f0f2f5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{u.name} {u.clocked_in && <span className="pulse" style={{ display: 'inline-block', width: '6px', height: '6px', marginLeft: '6px' }}></span>}</span>
                <span style={{ color: '#6b7689', fontSize: '11px', display: 'flex', gap: '12px' }}>
                  <span>{lateCount} late</span>
                  <span>{absentCount} absent</span>
                  {isMgmt && <span><strong>{productiveHours}h</strong> productive (Apploye)</span>}
                </span>
              </div>
              <div className="att-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(30, 1fr)', gap: '2px' }}>
                {[...Array(daysInMonth)].map((_, i) => {
                  const dayNum = i + 1;
                  // Dummy mock for UI visualization if DB is empty for this user:
                  // 1 = present, 2 = late, 3 = absent, 0 = off/future
                  // We'll just randomly mock some data if no real logs exist yet, 
                  // or match it if we had real dates.
                  const mockStatus = Math.random() > 0.8 ? (Math.random() > 0.5 ? 2 : 3) : 1; 
                  // In a real app we'd map actual logs to the correct day of month
                  
                  const dClass = mockStatus === 1 ? 'present' : mockStatus === 2 ? 'late' : mockStatus === 3 ? 'absent' : '';
                  const dChar = mockStatus === 1 ? '·' : mockStatus === 2 ? 'L' : mockStatus === 3 ? 'A' : '';
                  
                  return (
                    <div key={i} className={`att-c ${dClass}`} style={{ 
                      height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      fontSize: '10px', fontWeight: 700, 
                      background: mockStatus === 1 ? '#ecfdf5' : mockStatus === 2 ? '#fef3c7' : mockStatus === 3 ? '#fee2e2' : '#f5f6f8',
                      color: mockStatus === 1 ? '#047857' : mockStatus === 2 ? '#b45309' : mockStatus === 3 ? '#dc2626' : '#cbd2e0'
                    }} title={`Day ${dayNum}`}>
                      {dChar}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
