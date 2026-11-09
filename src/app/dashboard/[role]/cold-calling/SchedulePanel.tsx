'use client';

import { useState } from 'react';
import {
  WEEKDAYS, monthGrid, parseYmd, weekStartOf, weekDates, type CallDay,
} from '@/lib/coldCalling/types';

type Props = {
  dayMap: Record<string, CallDay>;
  today: string;
  selected: string;
  /** Monday of the week the summary below is showing. */
  weekStart: string;
  dailyTarget: number;
  onSelect: (date: string) => void;
  onTogglePlanned: (date: string) => void;
  /** Marks the five weekdays of one week as calling days in a single pass. */
  onPlanWeekdays: (weekStart: string) => void;
  onClearWeek: (weekStart: string) => void;
};

/**
 * The month calendar. Clicking a day selects it; the checkbox pip marks it as a
 * calling day, which is what feeds the week's working-day count.
 */
export default function SchedulePanel({
  dayMap, today, selected, weekStart, dailyTarget,
  onSelect, onTogglePlanned, onPlanWeekdays, onClearWeek,
}: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = parseYmd(selected);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const grid = monthGrid(cursor.year, cursor.month);
  const monthLabel = new Date(cursor.year, cursor.month, 1)
    .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const shift = (by: number) => {
    const next = new Date(cursor.year, cursor.month + by, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  const jumpToToday = () => {
    const d = parseYmd(today);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    onSelect(today);
  };

  const shownWeek = weekDates(weekStart);
  const plannedThisWeek = shownWeek.filter(d => dayMap[d]?.planned).length;

  return (
    <div className="pn">
      <div className="pn-h" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="pn-t">{monthLabel}</div>
          <div className="pn-s">Click a day to open it · tap the pip to mark it as a calling day</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm b-sec" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <button className="btn btn-sm b-sec" onClick={jumpToToday}>Today</button>
          <button className="btn btn-sm b-sec" onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
      </div>

      <div className="cc-cal">
        {WEEKDAYS.map(d => <div key={d} className="st-cal-h">{d}</div>)}

        {grid.map(date => {
          const row = dayMap[date];
          const outside = parseYmd(date).getMonth() !== cursor.month;
          const inShownWeek = weekStartOf(date) === weekStart;
          const hit = row?.planned && dailyTarget > 0 && (row.calls ?? 0) >= dailyTarget;

          return (
            <div
              key={date}
              className={[
                'cc-cal-d',
                outside ? 'out' : '',
                date === today ? 'today' : '',
                date === selected ? 'sel' : '',
                row?.planned ? 'planned' : '',
                inShownWeek ? 'in-week' : '',
              ].filter(Boolean).join(' ')}
            >
              <button className="cc-cal-hit" onClick={() => onSelect(date)} aria-label={`Open ${date}`}>
                <span className="cc-cal-n">{parseYmd(date).getDate()}</span>
                {(row?.calls ?? 0) > 0 && (
                  <span className={`cc-cal-c${hit ? ' hit' : ''}`}>{row!.calls}</span>
                )}
                {(row?.bookings ?? 0) > 0 && (
                  <span className="cc-cal-b">{row!.bookings} booked</span>
                )}
              </button>
              <button
                className="cc-pip"
                onClick={() => onTogglePlanned(date)}
                aria-pressed={!!row?.planned}
                aria-label={row?.planned ? `Unmark ${date} as a calling day` : `Mark ${date} as a calling day`}
                title={row?.planned ? 'Calling day — click to unmark' : 'Mark as a calling day'}
              >
                {row?.planned ? '✓' : ''}
              </button>
            </div>
          );
        })}
      </div>

      <div className="cc-cal-foot">
        <div className="st-cal-key" style={{ margin: 0, padding: 0, border: 0 }}>
          <span><i className="st-cal-sw" style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }} /> calling day</span>
          <span><i className="st-cal-sw today" /> today</span>
          <span><i className="st-cal-sw" style={{ background: 'var(--ok-soft)', borderColor: 'oklch(0.85 0.08 155)' }} /> target hit</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-sm b-sec" onClick={() => onPlanWeekdays(weekStart)}>
            Mark Mon–Fri
          </button>
          <button className="btn btn-sm b-sec" onClick={() => onClearWeek(weekStart)} disabled={plannedThisWeek === 0}>
            Clear the week
          </button>
        </div>
      </div>
    </div>
  );
}
