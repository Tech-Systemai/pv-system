'use client';

import { useState } from 'react';

type Log = {
  id?: string;
  user_id: string;
  date?: string;
  clock_in_time?: string;
  clock_out_time?: string;
  status?: string;
  productive_time_minutes?: number;
};

type User = { id: string; name: string; clocked_in?: boolean };

type Schedule = {
  user_id: string;
  shift_start: string;
  shift_end: string;
  week: string;
  day: string;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMondayKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getScheduledMins(schedules: Schedule[], userId: string, dateStr: string): number | null {
  const week = getMondayKey(dateStr);
  const day = DAY_NAMES[new Date(dateStr + 'T00:00:00').getDay()];
  const s = schedules.find(x => x.user_id === userId && x.week === week && x.day === day);
  if (!s?.shift_start || !s?.shift_end) return null;
  const [sh, sm] = s.shift_start.split(':').map(Number);
  const [eh, em] = s.shift_end.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  return endMins > startMins ? endMins - startMins : null;
}

function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(mins?: number | null) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
}

function fmtDate(dateStr?: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDay(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString([], { weekday: 'short' });
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  present: { bg: 'oklch(0.94 0.06 145)', color: 'oklch(0.38 0.14 145)', label: 'Present' },
  late:    { bg: 'oklch(0.95 0.07 85)',  color: 'oklch(0.46 0.15 85)',  label: 'Late'    },
  absent:  { bg: 'oklch(0.95 0.06 25)',  color: 'oklch(0.46 0.18 25)',  label: 'Absent'  },
};

export default function AttendanceClient({
  initialLogs,
  users,
  schedules,
  isMgmt,
  currentUserId,
}: {
  initialLogs: Log[];
  users: User[];
  schedules: Schedule[];
  isMgmt: boolean;
  currentUserId: string;
}) {
  const [logs] = useState<Log[]>(initialLogs);
  const [view, setView] = useState<'timesheet' | 'grid'>('timesheet');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.toISOString().split('T')[0];

  const usersToDisplay = isMgmt ? users : users.filter(u => u.id === currentUserId);
  const logsToDisplay = isMgmt ? logs : logs.filter(l => l.user_id === currentUserId);

  const presentLogs = logs.filter(l => l.status !== 'absent');
  const lateLogs    = logs.filter(l => l.status === 'late');
  const todayLogs   = logs.filter(l => l.date === today);
  const totalMins   = presentLogs.reduce((s, l) => s + (l.productive_time_minutes ?? 0), 0);
  const attendancePct = logs.length > 0 ? Math.round((presentLogs.length / logs.length) * 100) : 0;
  const avgShiftH = presentLogs.length > 0 ? totalMins / presentLogs.length / 60 : 0;

  const handleApployeSync = async () => {
    setIsSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/cron/apploye-pull', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      setSyncMsg(res.ok
        ? `Sync complete — ${json.processed ?? 0} records updated.`
        : (json?.error ?? 'Sync failed — check API key.'));
    } catch {
      setSyncMsg('Sync failed — network error.');
    }
    setIsSyncing(false);
  };

  const exportCSV = () => {
    const rows = ['Name,Date,Day,Clock In,Clock Out,Scheduled,Productive,Status'];
    for (const u of usersToDisplay) {
      const userLogs = logsToDisplay.filter(l => l.user_id === u.id);
      if (userLogs.length === 0) {
        rows.push(`${u.name},—,—,—,—,—,—,—`);
      } else {
        for (const l of userLogs) {
          const schMins = l.date ? getScheduledMins(schedules, u.id, l.date) : null;
          rows.push([
            u.name,
            l.date ?? '—',
            fmtDay(l.date),
            l.clock_in_time ? new Date(l.clock_in_time).toLocaleTimeString() : '—',
            l.clock_out_time ? new Date(l.clock_out_time).toLocaleTimeString() : '—',
            schMins ? fmtDuration(schMins) : '—',
            fmtDuration(l.productive_time_minutes),
            l.status ?? '—',
          ].join(','));
        }
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `timesheets-${today}.csv`;
    a.click();
  };

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
          <div className="stat-l">AVG PRODUCTIVE</div>
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
        }}>{syncMsg}</div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">
              {view === 'timesheet' ? 'Timesheet' : 'Monthly Grid'} — {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
            <div className="card-sub">{logsToDisplay.length} entries · synced via Apploye</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button className={`tab${view === 'timesheet' ? ' tab-a' : ''}`} onClick={() => setView('timesheet')}>Timesheet</button>
              <button className={`tab${view === 'grid' ? ' tab-a' : ''}`} onClick={() => setView('grid')}>Grid</button>
            </div>
            {isMgmt && (
              <button className="btn btn-sec btn-sm" onClick={handleApployeSync} disabled={isSyncing}>
                {isSyncing ? '↻ Syncing…' : '↻ Sync Apploye'}
              </button>
            )}
            <button className="btn btn-acc btn-sm" onClick={exportCSV}>↓ Export CSV</button>
          </div>
        </div>

        {view === 'timesheet' ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th title="Hours scheduled for this shift">Scheduled</th>
                  <th title="Tracked productive time from Apploye">Productive</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logsToDisplay.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '32px 0' }}>No attendance records yet</td></tr>
                ) : (
                  logsToDisplay
                    .slice()
                    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
                    .map((log, i) => {
                      const user = users.find(u => u.id === log.user_id);
                      const hue = ((user?.name || 'U').charCodeAt(0) * 13) % 360;
                      const st = STATUS_STYLE[log.status ?? 'present'] ?? STATUS_STYLE.present;
                      const isToday = log.date === today;
                      const schMins = log.date ? getScheduledMins(schedules, log.user_id, log.date) : null;
                      const prodMins = log.productive_time_minutes ?? 0;
                      const efficiency = schMins && schMins > 0 && prodMins > 0
                        ? Math.min(100, Math.round((prodMins / schMins) * 100))
                        : null;
                      return (
                        <tr key={log.id ?? i} style={{ background: isToday ? 'oklch(0.98 0.01 250)' : undefined }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="av-circle" style={{ width: 26, height: 26, fontSize: 9, flexShrink: 0, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                                {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) ?? '?'}
                              </div>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{user?.name ?? 'Unknown'}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: 13 }}>
                            {fmtDate(log.date)}
                            {isToday && <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--accent)', color: 'var(--accent-ink)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>TODAY</span>}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{fmtDay(log.date)}</td>
                          <td style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, color: 'oklch(0.40 0.12 145)' }}>
                            {fmtTime(log.clock_in_time)}
                          </td>
                          <td style={{ fontSize: 13, fontFamily: 'var(--mono)', color: log.clock_out_time ? 'oklch(0.40 0.12 25)' : 'var(--ink-4)' }}>
                            {fmtTime(log.clock_out_time)}
                          </td>
                          <td style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>
                            {schMins ? fmtDuration(schMins) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                          </td>
                          <td style={{ fontSize: 13, fontFamily: 'var(--mono)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: prodMins > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>
                                {fmtDuration(prodMins || null)}
                              </span>
                              {efficiency !== null && (
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                                  background: efficiency >= 90 ? 'oklch(0.94 0.06 145)' : efficiency >= 70 ? 'oklch(0.95 0.07 85)' : 'oklch(0.95 0.06 25)',
                                  color: efficiency >= 90 ? 'oklch(0.38 0.14 145)' : efficiency >= 70 ? 'oklch(0.46 0.15 85)' : 'oklch(0.46 0.18 25)',
                                }}>
                                  {efficiency}%
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span style={{ background: st.bg, color: st.color, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '0 18px 18px', overflowX: 'auto' }}>
            {/* Day header */}
            <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${daysInMonth}, 1fr)`, gap: 2, marginBottom: 6, minWidth: 700 }}>
              <div />
              {[...Array(daysInMonth)].map((_, i) => {
                const d = new Date(year, month, i + 1);
                const isToday = d.toDateString() === now.toDateString();
                const isWknd = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: isToday ? 'var(--accent-ink)' : isWknd ? 'var(--ink-4)' : 'var(--ink-3)' }}>
                    {i + 1}
                  </div>
                );
              })}
            </div>

            {usersToDisplay.map(u => {
              const userLogs = logs.filter(l => l.user_id === u.id);
              const lateCount  = userLogs.filter(l => l.status === 'late').length;
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
                        <div style={{ fontSize: 9, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>{lateCount}L · {absentCount}A · {(totalUserMins / 60).toFixed(0)}h</div>
                      </div>
                    </div>
                    {[...Array(daysInMonth)].map((_, i) => {
                      const log = getLogForDay(u.id, i + 1);
                      const d = new Date(year, month, i + 1);
                      const isFuture = (i + 1) > now.getDate() && month === now.getMonth() && year === now.getFullYear();
                      const isWknd = d.getDay() === 0 || d.getDay() === 6;

                      let bg = isWknd ? 'var(--surface-3)' : 'var(--surface-2)';
                      let dot = '';
                      let title = isFuture ? 'Future' : 'No record';

                      if (!isFuture && log) {
                        const inTime  = fmtTime(log.clock_in_time);
                        const outTime = fmtTime(log.clock_out_time);
                        const dur     = fmtDuration(log.productive_time_minutes);
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                        const schMins = getScheduledMins(schedules, u.id, dateStr);
                        const schStr = schMins ? ` · Sched: ${fmtDuration(schMins)}` : '';
                        if (log.status === 'late') {
                          bg = 'oklch(0.96 0.05 85)'; dot = 'L';
                          title = `Late · In: ${inTime} · Out: ${outTime} · ${dur}${schStr}`;
                        } else if (log.status === 'absent') {
                          bg = 'oklch(0.96 0.05 25)'; dot = 'A';
                          title = 'Absent';
                        } else {
                          bg = 'oklch(0.96 0.05 145)'; dot = '·';
                          title = `Present · In: ${inTime} · Out: ${outTime} · ${dur}${schStr}`;
                        }
                      }

                      const dotColor = dot === 'L' ? 'oklch(0.55 0.14 85)' : dot === 'A' ? 'oklch(0.50 0.18 25)' : dot === '·' ? 'oklch(0.48 0.14 145)' : 'var(--ink-4)';
                      return (
                        <div key={i} title={title} style={{ height: 22, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, background: bg, color: dotColor, cursor: 'default' }}>
                          {dot}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
              {[
                { bg: 'oklch(0.96 0.05 145)', color: 'oklch(0.48 0.14 145)', label: '· Present' },
                { bg: 'oklch(0.96 0.05 85)',  color: 'oklch(0.55 0.14 85)',  label: 'L  Late'    },
                { bg: 'oklch(0.96 0.05 25)',  color: 'oklch(0.50 0.18 25)',  label: 'A  Absent'  },
                { bg: 'var(--surface-2)',      color: 'var(--ink-4)',          label: '— No record' },
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
        )}
      </div>
    </div>
  );
}
