'use client';

import {
  COUNTERS, dayLabel, rate, sumDays, weekDates, type CallDay,
} from '@/lib/coldCalling/types';

type Props = {
  weekStart: string;
  dayMap: Record<string, CallDay>;
  dailyTarget: number;
  today: string;
  selected: string;
  onSelect: (date: string) => void;
};

/** Day by day down the week, with the totals and the rates underneath. */
export default function WeekBreakdown({
  weekStart, dayMap, dailyTarget, today, selected, onSelect,
}: Props) {
  const dates = weekDates(weekStart);
  const rows = dates.map(d => dayMap[d]).filter(Boolean) as CallDay[];
  const totals = sumDays(rows);
  const plannedCount = dates.filter(d => dayMap[d]?.planned).length;

  return (
    <div className="pn">
      <div className="pn-h">
        <div>
          <div className="pn-t">The week, day by day</div>
          <div className="pn-s">
            {plannedCount > 0
              ? `${plannedCount} calling ${plannedCount === 1 ? 'day' : 'days'} · ${dailyTarget.toLocaleString()} a day`
              : 'No calling days picked yet — mark some in the calendar above'}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="tbl cc-tbl">
          <thead>
            <tr>
              <th>Day</th>
              <th style={{ textAlign: 'right' }}>Target</th>
              {COUNTERS.map(c => (
                <th key={c.key} style={{ textAlign: 'right' }}>{c.short}</th>
              ))}
              <th style={{ textAlign: 'right' }}>Owner rate</th>
            </tr>
          </thead>
          <tbody>
            {dates.map(date => {
              const row = dayMap[date];
              const target = row?.planned ? dailyTarget : 0;
              const calls = row?.calls ?? 0;
              const hit = target > 0 && calls >= target;
              return (
                <tr
                  key={date}
                  className={[
                    date === selected ? 'sel' : '',
                    date === today ? 'today' : '',
                    row?.planned ? '' : 'off',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onSelect(date)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    {dayLabel(date)}
                    {date === today && <span className="st-chip" style={{ marginLeft: 7 }}>today</span>}
                    {!row?.planned && calls > 0 && <span className="st-chip" style={{ marginLeft: 7 }}>unplanned</span>}
                  </td>
                  <td className="num">{target > 0 ? target.toLocaleString() : '—'}</td>
                  {COUNTERS.map(c => {
                    const v = row?.[c.key] ?? 0;
                    const isCalls = c.key === 'calls';
                    return (
                      <td
                        key={c.key}
                        className={`num${isCalls && hit ? ' ok' : ''}`}
                        style={v === 0 ? { color: 'var(--ink-4)' } : undefined}
                      >
                        {v.toLocaleString()}
                      </td>
                    );
                  })}
                  <td className="num">{rate(row?.reached_owner ?? 0, calls)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td><b>Week total</b></td>
              <td className="num"><b>{(plannedCount * dailyTarget).toLocaleString()}</b></td>
              {COUNTERS.map(c => (
                <td key={c.key} className="num"><b>{totals[c.key].toLocaleString()}</b></td>
              ))}
              <td className="num"><b>{rate(totals.reached_owner, totals.calls)}</b></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
