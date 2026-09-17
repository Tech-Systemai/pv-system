'use client';

import { useMemo, useState } from 'react';
import { PRAYER_AR, PRAYER_ORDER } from '@/lib/smartTime/islamic';
import { fmtClock, minutesLabel } from '@/lib/smartTime/schedule';
import {
  CATEGORY_ICON, QUADRANT_META,
  type DayPlan, type PrayerTimes, type Quadrant, type Task,
} from '@/lib/smartTime/types';

export type StoredPlan = {
  plan_date: string;
  blocks: DayPlan['blocks'];
  prayer_times: PrayerTimes;
  hijri_date: string;
  period_mode: boolean;
  unscheduled: DayPlan['unscheduled'];
};

type Props = {
  tasks: Task[];
  /** Saved plans, most recent first. */
  plans: StoredPlan[];
  /** Today's live plan, which may be newer than what is saved. */
  todayPlan: DayPlan | null;
  periods: { started_on: string; ended_on: string | null }[];
  today: string;
  /** Builds a look-ahead plan for a day that has none saved. */
  onPreview: (date: string) => Promise<DayPlan | null>;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The 6×7 grid of dates covering a month, Monday first. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;          // Monday = 0
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export default function CalendarPanel({ tasks, plans, todayPlan, periods, today, onPreview }: Props) {
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const [selected, setSelected] = useState(today);
  const [preview, setPreview] = useState<DayPlan | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const planByDate = useMemo(
    () => Object.fromEntries(plans.map(p => [p.plan_date, p])),
    [plans],
  );

  const dueByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!t.due_on || t.status === 'dropped') continue;
      (map[t.due_on] ??= []).push(t);
    }
    return map;
  }, [tasks]);

  const periodDays = useMemo(() => {
    const days = new Set<string>();
    for (const p of periods) {
      const start = new Date(`${p.started_on}T00:00:00`);
      const end = p.ended_on ? new Date(`${p.ended_on}T00:00:00`) : new Date(`${today}T00:00:00`);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.add(ymd(d));
    }
    return days;
  }, [periods, today]);

  const grid = monthGrid(cursor.year, cursor.month);
  const monthLabel = new Date(cursor.year, cursor.month, 1)
    .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const shift = (by: number) => {
    const next = new Date(cursor.year, cursor.month + by, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  // What to show for the selected day: today's live plan, a saved one, or a
  // look-ahead built on demand.
  const savedForSelected = planByDate[selected];
  const shown: DayPlan | StoredPlan | null =
    selected === today ? (todayPlan ?? savedForSelected ?? preview) : (savedForSelected ?? preview);
  const isPreview = Boolean(preview && shown === preview);

  const selectDay = async (date: string) => {
    setSelected(date);
    setPreview(null);
    if (date === today || planByDate[date]) return;

    setPreviewing(true);
    const built = await onPreview(date);
    setPreview(built);
    setPreviewing(false);
  };

  const dueHere = dueByDate[selected] ?? [];
  const focusMinutes = (shown?.blocks ?? [])
    .filter(b => b.kind === 'task')
    .reduce((s, b) => s + b.minutes, 0);

  return (
    <div>
      {/* ── Month grid ── */}
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
          <div>
            <div className="card-title">{monthLabel}</div>
            <div className="card-sub">Everything with a date on it — planned blocks, deadlines and period days.</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => shift(-1)}>‹</button>
            <button
              className="btn btn-sm"
              onClick={() => {
                const [y, m] = today.split('-').map(Number);
                setCursor({ year: y, month: m - 1 });
                selectDay(today);
              }}
            >
              Today
            </button>
            <button className="btn btn-sm" onClick={() => shift(1)}>›</button>
          </div>
        </div>

        <div className="st-cal">
          {WEEKDAYS.map(d => <div key={d} className="st-cal-h">{d}</div>)}

          {grid.map(date => {
            const key = ymd(date);
            const outside = date.getMonth() !== cursor.month;
            const due = dueByDate[key] ?? [];
            const plan = key === today ? (todayPlan ?? planByDate[key]) : planByDate[key];
            const planned = (plan?.blocks ?? []).filter(b => b.kind === 'task').reduce((s, b) => s + b.minutes, 0);
            const overdue = due.some(t => t.status === 'open' && key < today);
            const worship = (plan?.blocks ?? []).some(b => b.kind === 'prayer' || b.kind === 'quran');

            return (
              <button
                key={key}
                className={[
                  'st-cal-d',
                  outside ? 'out' : '',
                  key === today ? 'today' : '',
                  key === selected ? 'sel' : '',
                  periodDays.has(key) ? 'period' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => selectDay(key)}
              >
                <div className="st-cal-top">
                  <span className="st-cal-n">{date.getDate()}</span>
                  {worship && <span className="st-cal-dot" title="Plan built for this day" />}
                </div>
                {planned > 0 && <span className="st-cal-m">{minutesLabel(planned)}</span>}
                {due.length > 0 && (
                  <span className={`st-cal-due${overdue ? ' late' : ''}`}>
                    {due.length} due
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="st-cal-key">
          <span><i className="st-cal-dot" /> plan built</span>
          <span><i className="st-cal-sw due" /> tasks due</span>
          <span><i className="st-cal-sw period" /> period day</span>
          <span><i className="st-cal-sw today" /> today</span>
        </div>
      </div>

      {/* ── Selected day ── */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div className="card-title">
              {new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
              {selected === today && ' · today'}
            </div>
            <div className="card-sub">
              {[
                shown?.hijri_date,
                focusMinutes > 0 && `${minutesLabel(focusMinutes)} of work planned`,
                periodDays.has(selected) && 'period day · Quran in place of Salah',
                isPreview && 'look-ahead — rebuilt from your open tasks, not saved',
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
          {previewing && <span className="st-chip"><span className="spin" />building…</span>}
        </div>

        {/* Prayer times for that day */}
        {shown && PRAYER_ORDER.some(p => shown.prayer_times?.[p]) && (
          <div className="st-strip" style={{ marginBottom: 14 }}>
            {PRAYER_ORDER.map(name => (
              <div key={name} className="st-pill">
                <div className="st-pill-n">
                  <span>{name}</span>
                  <span className="st-pill-ar">{PRAYER_AR[name]}</span>
                </div>
                <div className="st-pill-t">{fmtClock(shown.prayer_times[name] ?? '')}</div>
              </div>
            ))}
          </div>
        )}

        {/* Deadlines */}
        {dueHere.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="st-lbl">Due this day</div>
            {dueHere.map(t => (
              <div key={t.id} className="st-task">
                <div className="st-task-b">
                  <div className="st-task-t" style={t.status === 'done' ? { textDecoration: 'line-through', color: 'var(--ink-4)' } : undefined}>
                    {CATEGORY_ICON[t.category]} {t.title}
                  </div>
                  <div className="st-task-m">
                    <span className={`pv-bdg ${QUADRANT_META[t.quadrant as Quadrant].badge}`}>
                      {QUADRANT_META[t.quadrant as Quadrant].short}
                    </span>
                    <span className="st-chip">{minutesLabel(t.est_minutes)}</span>
                    {t.fixed_time && <span className="st-chip">{fmtClock(t.fixed_time)}</span>}
                    {t.status === 'done' && <span className="st-chip">done</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* The day's blocks */}
        {shown && shown.blocks.length > 0 ? (
          <>
            <div className="st-lbl">The day, block by block</div>
            <div className="scrollable" style={{ maxHeight: 420 }}>
              {shown.blocks.map((b, i) => (
                <div key={`${b.start}-${i}`} className={`st-cal-row st-k-${b.kind}`}>
                  <span className="st-row-time" style={{ padding: 0 }}>{fmtClock(b.start)}</span>
                  <span className="st-bar" />
                  <span className="st-cal-row-l">
                    {b.label}
                    {b.part && <span className="st-chip" style={{ marginLeft: 7 }}>{b.part}</span>}
                  </span>
                  <span className="st-row-m" style={{ padding: 0 }}>{minutesLabel(b.minutes)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          !previewing && (
            <div className="empty">
              {dueHere.length > 0
                ? 'Nothing blocked out for this day yet — only the deadlines above.'
                : 'Nothing scheduled for this day.'}
            </div>
          )
        )}
      </div>
    </div>
  );
}
