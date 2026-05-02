'use client';

import React, { useState } from 'react';
import { dbOp } from '@/utils/db';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHIFT_PRESETS = [
  { label: 'Morning (9–5)', start: '09:00', end: '17:00' },
  { label: 'Afternoon (1–9)', start: '13:00', end: '21:00' },
  { label: 'Evening (4–12)', start: '16:00', end: '24:00' },
  { label: 'Half Day (9–1)', start: '09:00', end: '13:00' },
];

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
  initialSchedules,
  users,
  isMgmt,
  currentUserId,
}: {
  initialSchedules: any[];
  users: any[];
  isMgmt: boolean;
  currentUserId: string;
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
      const payload: Shift = {
        user_id: editCell.userId,
        week: weekKey,
        day: editCell.day,
        shift_start: editStart,
        shift_end: editEnd,
      };
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

  const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    sales: { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
    cx: { bg: '#e0f2fe', text: '#075985', border: '#7dd3fc' },
    supervisor: { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
  };

  return (
    <div>
      {/* Week navigation */}
      <div className="pn-h" style={{ marginBottom: '20px' }}>
        <div>
          <div className="pn-t">Team Schedule</div>
          <div style={{ fontSize: '12px', color: '#6b7689', marginTop: '2px' }}>{weekLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="pv-btn pv-btn-sec" onClick={() => setWeekOffset(w => w - 1)}>← Prev</button>
          <button className="pv-btn pv-btn-sec" onClick={() => setWeekOffset(0)} style={{ opacity: weekOffset === 0 ? 0.5 : 1 }}>This week</button>
          <button className="pv-btn pv-btn-sec" onClick={() => setWeekOffset(w => w + 1)}>Next →</button>
        </div>
      </div>

      {isMgmt && (
        <div style={{ fontSize: '12px', color: '#6b7689', marginBottom: '12px', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px' }}>
          Click any cell to assign or edit a shift. Click again to remove.
        </div>
      )}

      {/* Grid */}
      <div className="pn" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(7, 1fr)`, gap: '4px', minWidth: '640px' }}>
          {/* Header row */}
          <div />
          {DAYS.map((d, i) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <div key={d} style={{
                textAlign: 'center', padding: '6px 4px', fontSize: '11px', fontWeight: 700,
                color: isToday ? '#4f46e5' : '#4a5568',
                textTransform: 'uppercase',
                borderBottom: isToday ? '2px solid #4f46e5' : '2px solid transparent',
              }}>
                {d}<br />
                <span style={{ fontSize: '10px', fontWeight: 400, color: '#9ca3af' }}>
                  {date.getDate()}
                </span>
              </div>
            );
          })}

          {/* Employee rows */}
          {visibleUsers.map(emp => {
            const colors = ROLE_COLORS[emp.role] ?? { bg: '#f5f6f8', text: '#4a5568', border: '#e4e7eb' };
            return (
              <React.Fragment key={emp.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px' }}>
                  <div className="av gy" style={{ width: '28px', height: '28px', fontSize: '10px', flexShrink: 0 }}>
                    {emp.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.2 }}>{emp.name?.split(' ')[0]}</div>
                    <div style={{ fontSize: '9.5px', color: '#9ca3af', textTransform: 'uppercase' }}>{emp.role}</div>
                  </div>
                </div>
                {DAYS.map(day => {
                  const shift = getShift(emp.id, day);
                  return (
                    <div
                      key={`${emp.id}-${day}`}
                      onClick={() => openEdit(emp.id, day)}
                      style={{
                        height: '44px', borderRadius: '6px', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', fontSize: '9.5px', fontWeight: 600,
                        background: shift ? colors.bg : '#f9fafb',
                        color: shift ? colors.text : '#d1d5db',
                        border: `1px solid ${shift ? colors.border : '#f0f2f5'}`,
                        cursor: isMgmt ? 'pointer' : 'default',
                        transition: 'all 0.15s',
                      }}
                    >
                      {shift ? (
                        <>
                          <span>{shift.shift_start}</span>
                          <span style={{ fontSize: '8px', opacity: 0.7 }}>{shift.shift_end}</span>
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
      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
        {Object.entries(ROLE_COLORS).map(([role, c]) => (
          <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: c.bg, border: `1px solid ${c.border}` }} />
            <span style={{ color: '#4a5568', textTransform: 'capitalize' }}>{role}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f9fafb', border: '1px solid #f0f2f5' }} />
          <span style={{ color: '#9ca3af' }}>Off / Unscheduled</span>
        </div>
      </div>

      {/* Edit modal */}
      {editCell && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '360px', maxWidth: '95%' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>
              Assign Shift — {editCell.day}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7689', marginBottom: '16px' }}>
              {users.find(u => u.id === editCell.userId)?.name}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {SHIFT_PRESETS.map(p => (
                <button
                  key={p.label}
                  className="pv-btn pv-btn-sec"
                  style={{ fontSize: '11px' }}
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Start</label>
                <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)} />
              </div>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>End</label>
                <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="pv-btn pv-btn-pri" onClick={() => saveShift(false)} disabled={saving} style={{ flex: 1 }}>
                {saving ? '...' : 'Save Shift'}
              </button>
              <button
                className="pv-btn pv-btn-sec"
                onClick={() => saveShift(true)}
                disabled={saving}
                style={{ color: '#dc2626' }}
              >
                Set Off
              </button>
              <button className="pv-btn pv-btn-sec" onClick={() => setEditCell(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
