'use client';

import { useState } from 'react';

type Log = {
  user_id: string;
  date?: string;
  clock_in_time?: string;
  status?: string;
  productive_time_minutes?: number;
};

export default function AttendanceClient({
  initialLogs,
  users,
  isMgmt,
  currentUserId,
}: {
  initialLogs: Log[];
  users: any[];
  isMgmt: boolean;
  currentUserId: string;
}) {
  const [logs] = useState<Log[]>(initialLogs);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const handleApployeSync = async () => {
    setIsSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/cron/apploye-pull', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      setSyncMsg(res.ok ? 'Apploye sync completed. Productive hours updated.' : (json?.error ?? 'Sync failed — check API key.'));
    } catch {
      setSyncMsg('Sync failed — network error.');
    }
    setIsSyncing(false);
  };

  const exportCSV = () => {
    const rows = ['Name,Date,Clock In,Status,Productive Minutes'];
    const usersToExport = isMgmt ? users : users.filter(u => u.id === currentUserId);
    for (const u of usersToExport) {
      const userLogs = logs.filter(l => l.user_id === u.id);
      if (userLogs.length === 0) {
        rows.push(`${u.name},—,—,—,—`);
      } else {
        for (const l of userLogs) {
          rows.push([
            u.name,
            l.date ?? '—',
            l.clock_in_time ? new Date(l.clock_in_time).toLocaleTimeString() : '—',
            l.status ?? '—',
            l.productive_time_minutes ?? 0,
          ].join(','));
        }
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheets-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = now.toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.date === today);
  const usersToDisplay = isMgmt ? users : users.filter(u => u.id === currentUserId);

  const getLogForDay = (userId: string, day: number): Log | undefined => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return logs.find(l => l.user_id === userId && l.date === dateStr);
  };

  return (
    <>
      <div className="pn-h" style={{ marginBottom: '14px' }}>
        <div>
          <div className="pn-t">Attendance & Time Tracking</div>
          <div style={{ fontSize: '12px', color: '#6b7689', marginTop: '2px' }}>
            {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isMgmt && (
            <button className="pv-btn pv-btn-sec" onClick={handleApployeSync} disabled={isSyncing}>
              {isSyncing ? 'Syncing...' : '↻ Sync Apploye'}
            </button>
          )}
          <button className="pv-btn pv-btn-pri" onClick={exportCSV}>↓ Export CSV</button>
        </div>
      </div>

      {syncMsg && (
        <div style={{ background: syncMsg.includes('failed') ? '#fee2e2' : '#ecfdf5', color: syncMsg.includes('failed') ? '#dc2626' : '#047857', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>
          {syncMsg}
        </div>
      )}

      {isMgmt && (
        <div className="three" style={{ marginBottom: '14px' }}>
          <div className="stat">
            <div className="s-l">Clocked In (Live)</div>
            <div className="s-v gn">{users.filter(u => u.clocked_in).length}</div>
          </div>
          <div className="stat">
            <div className="s-l">Late Today</div>
            <div className="s-v am">{todayLogs.filter(l => l.status === 'late').length}</div>
          </div>
          <div className="stat">
            <div className="s-l">No-Shows</div>
            <div className="s-v rd">{todayLogs.filter(l => l.status === 'absent').length}</div>
          </div>
        </div>
      )}

      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '16px' }}>Monthly Attendance Grid</div>

        {/* Day number header */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(' + daysInMonth + ', 1fr)', gap: '2px', marginBottom: '6px', minWidth: '600px', overflowX: 'auto' }}>
          <div />
          {[...Array(daysInMonth)].map((_, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: '9px', color: '#9ca3af', fontWeight: 600 }}>
              {i + 1}
            </div>
          ))}
        </div>

        <div style={{ overflowX: 'auto' }}>
          {usersToDisplay.map(u => {
            const userLogs = logs.filter(l => l.user_id === u.id);
            const lateCount = userLogs.filter(l => l.status === 'late').length;
            const absentCount = userLogs.filter(l => l.status === 'absent').length;
            const totalMins = userLogs.reduce((a, l) => a + (l.productive_time_minutes ?? 0), 0);

            return (
              <div key={u.id} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '140px', flexShrink: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '12px', color: '#1a1f2e' }}>{u.name}</span>
                    {u.clocked_in && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />}
                  </div>
                  <span style={{ color: '#6b7689', fontSize: '10px', display: 'flex', gap: '10px' }}>
                    <span>{lateCount}L</span>
                    <span>{absentCount}A</span>
                    {isMgmt && <span>{(totalMins / 60).toFixed(1)}h</span>}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(' + daysInMonth + ', 1fr)', gap: '2px', minWidth: '600px' }}>
                  <div />
                  {[...Array(daysInMonth)].map((_, i) => {
                    const dayNum = i + 1;
                    const log = getLogForDay(u.id, dayNum);
                    const isFuture = dayNum > now.getDate() && month === now.getMonth() && year === now.getFullYear();

                    let bg = '#f5f6f8';
                    let color = '#d1d5db';
                    let label = '';

                    if (!isFuture && log) {
                      if (log.status === 'late') { bg = '#fef3c7'; color = '#b45309'; label = 'L'; }
                      else if (log.status === 'absent') { bg = '#fee2e2'; color = '#dc2626'; label = 'A'; }
                      else { bg = '#ecfdf5'; color = '#047857'; label = '·'; }
                    } else if (!isFuture && !log) {
                      // No log exists for a past day — treat as absent or off
                      bg = '#f5f6f8'; color = '#d1d5db'; label = '';
                    }

                    return (
                      <div
                        key={i}
                        title={log ? `${log.status ?? 'present'} · ${log.productive_time_minutes ?? 0}min` : isFuture ? 'Future' : 'No record'}
                        style={{ height: '22px', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, background: bg, color }}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '16px', marginTop: '14px', fontSize: '11px' }}>
          {[
            { bg: '#ecfdf5', color: '#047857', label: '· Present' },
            { bg: '#fef3c7', color: '#b45309', label: 'L  Late' },
            { bg: '#fee2e2', color: '#dc2626', label: 'A  Absent' },
            { bg: '#f5f6f8', color: '#d1d5db', label: '— No record' },
          ].map(({ bg, color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700 }}>
                {label[0]}
              </div>
              <span style={{ color: '#6b7689' }}>{label.slice(1).trim()}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
