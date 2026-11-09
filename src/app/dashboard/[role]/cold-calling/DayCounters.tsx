'use client';

import { COUNTERS, longDayLabel, rate, type CallDay, type CounterKey } from '@/lib/coldCalling/types';

type Props = {
  day: CallDay;
  dailyTarget: number;
  isToday: boolean;
  onBump: (key: CounterKey, by: number) => void;
  onSet: (key: CounterKey, value: number) => void;
  onNote: (note: string) => void;
  onTogglePlanned: () => void;
};

/** The counters for one day — the thing you actually tap while you are dialling. */
export default function DayCounters({
  day, dailyTarget, isToday, onBump, onSet, onNote, onTogglePlanned,
}: Props) {
  const target = day.planned ? dailyTarget : 0;
  const left = Math.max(0, target - day.calls);
  const percent = target > 0 ? Math.min(100, Math.round((day.calls / target) * 100)) : 0;

  return (
    <div className="pn">
      <div className="pn-h" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="pn-t">
            {longDayLabel(day.call_date)}{isToday && ' · today'}
          </div>
          <div className="pn-s">
            {day.planned
              ? target > 0
                ? `${day.calls.toLocaleString()} of ${target.toLocaleString()} · ${left.toLocaleString()} to go`
                : 'A calling day — set a daily target to get a number to chase'
              : 'Not marked as a calling day. Tap a counter anyway and it still counts towards the week.'}
          </div>
        </div>
        <button
          className={`btn btn-sm ${day.planned ? 'b-sec' : 'b-pri'}`}
          onClick={onTogglePlanned}
        >
          {day.planned ? 'Unmark calling day' : 'Mark as calling day'}
        </button>
      </div>

      {target > 0 && (
        <div className="bw" style={{ marginBottom: 14 }}>
          <div
            className="bf"
            style={{
              width: `${percent}%`,
              background: percent >= 100 ? 'var(--ok)' : 'var(--accent)',
            }}
          />
        </div>
      )}

      <div className="cc-counters">
        {COUNTERS.map(c => (
          <div key={c.key} className="cc-ctr">
            <div className="cc-ctr-h">
              <span className={`s-ico ${c.tone}`} aria-hidden>{c.icon}</span>
              <span className="cc-ctr-l">{c.label}</span>
            </div>

            <input
              className="cc-ctr-v"
              type="number"
              min={0}
              inputMode="numeric"
              value={day[c.key]}
              onChange={e => onSet(c.key, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              onFocus={e => e.currentTarget.select()}
              aria-label={`${c.label} on ${day.call_date}`}
            />

            <div className="cc-ctr-btns">
              <button className="cc-bump" onClick={() => onBump(c.key, 1)} aria-label={`Add one to ${c.label}`}>+1</button>
              <button
                className="cc-bump minus"
                onClick={() => onBump(c.key, -1)}
                disabled={day[c.key] === 0}
                aria-label={`Take one off ${c.label}`}
              >
                −
              </button>
            </div>

            <div className="cc-ctr-hint">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="cc-rates">
        <span><b>{rate(day.reached_owner, day.calls)}</b> reached the owner</span>
        <span><b>{rate(day.bookings, day.reached_owner)}</b> of those booked</span>
        <span><b>{rate(day.closed, day.bookings)}</b> of bookings closed</span>
        <span><b>{rate(day.not_interested, day.reached_owner)}</b> said no</span>
      </div>

      <div className="fld" style={{ marginBottom: 0, marginTop: 14 }}>
        <label htmlFor="cc-note">Notes on the day</label>
        <textarea
          id="cc-note"
          rows={2}
          value={day.note}
          placeholder="What worked, what the objections were, who to call back…"
          onChange={e => onNote(e.target.value)}
        />
      </div>
    </div>
  );
}
