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

  const totalMins = logs.reduce((s, l) => s + (l.productive_time_minutes ?? 0), 0);
  const presentLogs = logs.filter(l => l.status !== 'absent');
  const attendancePct = logs.length > 0 ? Math.round((presentLogs.length / logs.length) * 100) : 0;
  const lateLogs = logs.filter(l => l.status === 'late');
  const absentLogs = logs.filter(l => l.status === 'absent');
  const avgShiftH = presentLogs.length > 0 ? (totalMins / presentLogs.length / 60) : 0;

  const getLogForDay = (userId: string, day: number): Log | undefined => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return logs.find(l => l.user_id === userId && l.date === dateStr);
  };

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">ATTENDANCE RATE</div>
          <div className="stat-v" style={{ color: attendancePct >= 90 ? 'var(--ok)' : attendancePct >= 70 ? 'var(--warn)' : 'var(--err)' }}>{attendancePct}%</div>
          <div className="stat-foot">{presentLogs.length} of {logs.length} logged days</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">⚠</div></div>
          <div className="stat-l">LATE THIS MONTH</div>
          <div className="stat-v" style={{ color: 'var(--warn)' }}>{lateLogs.length}</div>
          <div className="stat-foot">Late arrivals recorded</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico er">✕</div></div>
          <div className="stat-l">ABSENT TODAY</div>
          <div className="stat-v" style={{ color: 'var(--err)' }}>{todayLogs.filter(l => l.status === 'absent').length}</div>
          <div className="stat-foot">{users.filter(u => u.clocked_in).length} currently clocked in</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">◷</div></div>
          <div className="stat-l">AVG SHIFT</div>
          <div className="stat-v">{avgShiftH.toFixed(1)}<span style={{ fontSize: 14, color: 'var(--ink-3)', fontWeight: 400 }}>h</span></div>
          <div className="stat-foot">Per tracked session</div>
        </div>
      </div>

      {syncMsg && (
        <div style={{
          background: syncMsg.includes('failed') ? 'oklch(0.97 0.03 25)' : 'oklch(0.97 0.03 145)',
          color: syncMsg.includes('failed') ? 'var(--err)' : 'var(--ok)',
          border: `1px solid ${syncMsg.includes('failed') ? 'oklch(0.88 0.07 25)' : 'oklch(0.88 0.07 145)'}`,
          padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
        }}>
          {syncMsg}
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Monthly Attendance Grid</div>
            <div className="card-sub">{now.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isMgmt && (
              <button className="btn btn-sec btn-sm" onClick={handleApployeSync} disabled={isSyncing}>
                {isSyncing ? '↻ Syncing…' : '↻ Sync Apploye'}
              </button>
            )}
            <button className="btn btn-acc btn-sm" onClick={exportCSV}>↓ Export CSV</button>
          </div>
        </div>

        <div style={{ padding: '0 18px 18px', overflowX: 'auto' }}>
          {/* Day header */}
          <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${daysInMonth}, 1fr)`, gap: 2, marginBottom: 6, minWidth: 700 }}>
            <div />
            {[...Array(daysInMonth)].map((_, i) => {
              const d = new Date(year, month, i + 1);
              const isToday = d.toDateString() === now.toDateString();
              const isWknd = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={i} style={{
                  textAlign: 'center', fontSize: 9, fontWeight: 700,
                  color: isToday ? 'var(--accent-ink)' : isWknd ? 'var(--ink-4)' : 'var(--ink-3)',
                }}>
                  {i + 1}
                </div>
              );
            })}
          </div>

          {/* Employee rows */}
          {usersToDisplay.map(u => {
            const userLogs = logs.filter(l => l.user_id === u.id);
            const lateCount = userLogs.filter(l => l.status === 'late').length;
            const absentCount = userLogs.filter(l => l.status === 'absent').length;
            const totalUserMins = userLogs.reduce((a, l) => a + (l.productive_time_minutes ?? 0), 0);
            const hue = ((u.name || 'U').charCodeAt(0) * 13) % 360;

            return (
              <div key={u.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${daysInMonth}, 1fr)`, gap: 2, minWidth: 700 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8 }}>
                    <div className="av-circle" style={{ width: 26, height: 26, fontSize: 9, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))`, flexShrink: 0 }}>
                      {u.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name?.split(' ')[0]}</div>
                      <div style={{ fontSize: 9, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
                        {lateCount}L · {absentCount}A · {(totalUserMins / 60).toFixed(0)}h
                      </div>
                    </div>
                  </div>
                  {[...Array(daysInMonth)].map((_, i) => {
                    const dayNum = i + 1;
                    const log = getLogForDay(u.id, dayNum);
                    const isFuture = dayNum > now.getDate() && month === now.getMonth() && year === now.getFullYear();
                    const d = new Date(year, month, dayNum);
                    const isWknd = d.getDay() === 0 || d.getDay() === 6;

                    let bg = isWknd ? 'var(--surface-3)' : 'var(--surface-2)';
                    let dot = '';
                    let title = isFuture ? 'Future' : 'No record';

                    if (!isFuture && log) {
                      if (log.status === 'late') { bg = 'oklch(0.96 0.05 85)'; dot = 'L'; title = `Late · ${log.productive_time_minutes ?? 0}min`; }
                      else if (log.status === 'absent') { bg = 'oklch(0.96 0.05 25)'; dot = 'A'; title = 'Absent'; }
                      else { bg = 'oklch(0.96 0.05 145)'; dot = '·'; title = `Present · ${log.productive_time_minutes ?? 0}min`; }
                    }

                    const dotColor = dot === 'L' ? 'oklch(0.55 0.14 85)' : dot === 'A' ? 'oklch(0.50 0.18 25)' : dot === '·' ? 'oklch(0.48 0.14 145)' : 'var(--ink-4)';

                    return (
                      <div
                        key={i}
                        title={title}
                        style={{
                          height: 22, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 8, fontWeight: 800, background: bg, color: dotColor,
                        }}
                      >
                        {dot}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { bg: 'oklch(0.96 0.05 145)', color: 'oklch(0.48 0.14 145)', label: '· Present' },
              { bg: 'oklch(0.96 0.05 85)', color: 'oklch(0.55 0.14 85)', label: 'L  Late' },
              { bg: 'oklch(0.96 0.05 25)', color: 'oklch(0.50 0.18 25)', label: 'A  Absent' },
              { bg: 'var(--surface-2)', color: 'var(--ink-4)', label: '— No record' },
            ].map(({ bg, color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800 }}>
                  {label[0]}
                </div>
                <span style={{ color: 'var(--ink-3)' }}>{label.slice(1).trim()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
