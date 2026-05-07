'use client';

import React, { useState } from 'react';
import { dbOp } from '@/utils/db';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHIFT_PRESETS = [
  { label: 'Morning (9–5)',   start: '09:00', end: '17:00' },
  { label: 'Afternoon (1–9)', start: '13:00', end: '21:00' },
  { label: 'Evening (4–12)',  start: '16:00', end: '24:00' },
  { label: 'Half Day (9–1)',  start: '09:00', end: '13:00' },
];

const ROLE_HUES: Record<string, number> = {
  sales: 75, cx: 200, supervisor: 268, admin: 290, accountant: 155,
};

function getMondayOfWeek(offset = 0) {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(monday: Date) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

type Shift = { id?: string; user_id: string; week: string; day: string; shift_start: string; shift_end: string };

export default function ScheduleClient({
  initialSchedules, users, isMgmt, currentUserId,
}: {
  initialSchedules: any[]; users: any[]; isMgmt: boolean; currentUserId: string;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const monday = getMondayOfWeek(weekOffset);
  const weekKey = monday.toISOString().split('T')[0];
  const weekLabel = formatWeekLabel(monday);

  const [shifts, setShifts] = useState<Shift[]>(() =>
    initialSchedules.filter(s => s.user_id && s.day && s.shift_start)
  );
  const [editCell, setEditCell] = useState<{ userId: string; day: string } | null>(null);
  const [editStart, setEditStart] = useState('09:00');
  const [editEnd, setEditEnd] = useState('17:00');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const weekShifts = shifts.filter(s => s.week === weekKey);
  const plannedCount = weekShifts.length;
  const totalSlots = users.length * 5;
  const gaps = Math.max(0, totalSlots - plannedCount);
  const approvedCount = weekShifts.length;

  const getShift = (userId: string, day: string): Shift | undefined =>
    shifts.find(s => s.user_id === userId && s.day === day && s.week === weekKey);

  const openEdit = (userId: string, day: string) => {
    if (!isMgmt) return;
    const existing = getShift(userId, day);
    setEditStart(existing?.shift_start ?? '09:00');
    setEditEnd(existing?.shift_end ?? '17:00');
    setEditCell({ userId, day });
  };

  const applyPreset = (p: typeof SHIFT_PRESETS[0]) => {
    setEditStart(p.start);
    setEditEnd(p.end);
  };

  const saveShift = async (off = false) => {
    if (!editCell) return;
    setSaving(true);
    const existing = getShift(editCell.userId, editCell.day);
    if (off) {
      if (existing?.id) {
        await dbOp('schedules', 'delete', undefined, { id: existing.id });
        setShifts(prev => prev.filter(s => s.id !== existing.id));
      }
    } else {
      const payload: Shift = { user_id: editCell.userId, week: weekKey, day: editCell.day, shift_start: editStart, shift_end: editEnd };
      if (existing?.id) {
        await dbOp('schedules', 'update', { shift_start: editStart, shift_end: editEnd }, { id: existing.id });
        setShifts(prev => prev.map(s => s.id === existing.id ? { ...s, shift_start: editStart, shift_end: editEnd } : s));
      } else {
        const { data } = await dbOp('schedules', 'insert', payload);
        if (data?.[0]) setShifts(prev => [...prev, data[0]]);
      }
    }
    setEditCell(null);
    setSaving(false);
  };

  const visibleUsers = isMgmt ? users : users.filter(u => u.id === currentUserId);

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📅</div></div>
          <div className="stat-l">WEEK OF</div>
          <div className="stat-v" style={{ fontSize: 15, marginTop: 6 }}>{monday.toLocaleDateString('default', { month: 'short', day: 'numeric' })}</div>
          <div className="stat-foot">{weekLabel}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">SHIFTS PLANNED</div>
          <div className="stat-v">{plannedCount}<span style={{ fontSize: 14, color: 'var(--ink-3)' }}>/{totalSlots}</span></div>
          <div className="stat-foot">Across {visibleUsers.length} staff, 5 days</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico er">⚠</div></div>
          <div className="stat-l">GAPS</div>
          <div className="stat-v" style={{ color: gaps > 0 ? 'var(--err)' : 'var(--ok)' }}>{gaps}</div>
          <div className="stat-foot">{gaps > 0 ? 'Unscheduled slots this week' : 'All slots filled'}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">📋</div></div>
          <div className="stat-l">APPROVED</div>
          <div className="stat-v">{submitted ? approvedCount : 0}<span style={{ fontSize: 14, color: 'var(--ink-3)' }}>/{plannedCount}</span></div>
          <div className="stat-foot">{submitted ? 'Submitted for approval' : 'Pending submission'}</div>
        </div>
      </div>

      {/* Header */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Team Schedule</div>
            <div className="card-sub">{weekLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-sec btn-sm" onClick={() => setWeekOffset(w => w - 1)}>← Prev</button>
            <button className="btn btn-sec btn-sm" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>This week</button>
            <button className="btn btn-sec btn-sm" onClick={() => setWeekOffset(w => w + 1)}>Next →</button>
            {isMgmt && (
              <button
                className={`btn btn-sm ${submitted ? 'btn-sec' : 'btn-acc'}`}
                onClick={() => setSubmitted(s => !s)}
              >
                {submitted ? '✓ Submitted' : 'Submit for Approval'}
              </button>
            )}
          </div>
        </div>

        {isMgmt && (
          <div style={{ padding: '0 18px 10px', fontSize: 12, color: 'var(--ink-3)' }}>
            Click any cell to assign or edit a shift.
          </div>
        )}

        {/* Schedule grid */}
        <div style={{ overflowX: 'auto', padding: '0 18px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(7, 1fr)`, gap: 4, minWidth: 700 }}>
            {/* Header */}
            <div />
            {DAYS.map((d, i) => {
              const date = new Date(monday);
              date.setDate(monday.getDate() + i);
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div key={d} style={{ textAlign: 'center', padding: '6px 4px', fontSize: 11, fontWeight: 700, color: isToday ? 'var(--accent-ink)' : 'var(--ink-3)', textTransform: 'uppercase', borderBottom: isToday ? '2px solid var(--accent)' : '2px solid transparent' }}>
                  {d}<br />
                  <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--ink-4)' }}>{date.getDate()}</span>
                </div>
              );
            })}

            {/* Employee rows */}
            {visibleUsers.map(emp => {
              const hue = ROLE_HUES[emp.role] ?? 268;
              const cellBg = `oklch(0.96 0.04 ${hue})`;
              const cellText = `oklch(0.40 0.12 ${hue})`;
              const cellBorder = `oklch(0.85 0.06 ${hue})`;
              return (
                <React.Fragment key={emp.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 4px 0' }}>
                    <div className="av-circle" style={{ width: 28, height: 28, fontSize: 10, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                      {emp.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{emp.name?.split(' ')[0]}</div>
                      <div style={{ fontSize: 9.5, color: 'var(--ink-4)', textTransform: 'uppercase' }}>{emp.role}</div>
                    </div>
                  </div>
                  {DAYS.map(day => {
                    const shift = getShift(emp.id, day);
                    return (
                      <div
                        key={`${emp.id}-${day}`}
                        onClick={() => openEdit(emp.id, day)}
                        style={{
                          height: 48, borderRadius: 7, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 600,
                          background: shift ? cellBg : 'var(--surface-3)',
                          color: shift ? cellText : 'var(--ink-4)',
                          border: `1px solid ${shift ? cellBorder : 'var(--line-2)'}`,
                          cursor: isMgmt ? 'pointer' : 'default',
                          transition: 'all .12s',
                        }}
                      >
                        {shift ? (
                          <>
                            <span>{shift.shift_start}</span>
                            <span style={{ fontSize: 8, opacity: 0.7 }}>{shift.shift_end}</span>
                          </>
                        ) : (
                          <span>{isMgmt ? '+' : '—'}</span>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ padding: '0 18px 16px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {Object.entries(ROLE_HUES).map(([role, hue]) => (
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: `oklch(0.96 0.04 ${hue})`, border: `1px solid oklch(0.85 0.06 ${hue})` }} />
              <span style={{ color: 'var(--ink-3)', textTransform: 'capitalize' }}>{role}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--surface-3)', border: '1px solid var(--line-2)' }} />
            <span style={{ color: 'var(--ink-4)' }}>Off / Unscheduled</span>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editCell && (
        <div className="mb">
          <div className="md" style={{ width: 360 }}>
            <div className="md-t">Assign Shift — {editCell.day}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16, marginTop: -8 }}>
              {users.find(u => u.id === editCell.userId)?.name}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {SHIFT_PRESETS.map(p => (
                <button key={p.label} className="btn btn-sec btn-sm" style={{ fontSize: 11 }} onClick={() => applyPreset(p)}>
                  {p.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Start</label>
                <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)} />
              </div>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>End</label>
                <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-acc" onClick={() => saveShift(false)} disabled={saving} style={{ flex: 1 }}>
                {saving ? '…' : 'Save Shift'}
              </button>
              <button className="btn btn-sec" onClick={() => saveShift(true)} disabled={saving} style={{ color: 'oklch(0.45 0.16 25)' }}>
                Set Off
              </button>
              <button className="btn btn-sec" onClick={() => setEditCell(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
