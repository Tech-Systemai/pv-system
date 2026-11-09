'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dbOp } from '@/utils/db';
import SchedulePanel from './SchedulePanel';
import DayCounters from './DayCounters';
import WeekBreakdown from './WeekBreakdown';
import {
  COUNTER_KEYS, addDays, emptyDay, rate, summarise, weekDates, weekLabel,
  weekStartOf, ymd,
  type CallDay, type CallWeek, type CounterKey,
} from '@/lib/coldCalling/types';

type Props = {
  userId: string;
  initialDailyTarget: number;
  initialDays: CallDay[];
  initialWeeks: CallWeek[];
  schemaReady: boolean;
};

/** The columns we send back; created_at is left alone so upserts keep it. */
const DAY_COLUMNS = ['user_id', 'call_date', 'planned', ...COUNTER_KEYS, 'note'] as const;

function dayPayload(row: CallDay) {
  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const col of DAY_COLUMNS) out[col] = row[col as keyof CallDay];
  return out;
}

export default function ColdCallingClient({
  userId, initialDailyTarget, initialDays, initialWeeks, schemaReady,
}: Props) {
  const today = ymd(new Date());
  const thisWeek = weekStartOf(today);

  const [dayMap, setDayMap] = useState<Record<string, CallDay>>(() =>
    Object.fromEntries(initialDays.map(d => [d.call_date, d])));
  const [weekMap, setWeekMap] = useState<Record<string, CallWeek>>(() =>
    Object.fromEntries(initialWeeks.map(w => [w.week_start, w])));
  const [prefTarget, setPrefTarget] = useState(initialDailyTarget);

  const [selected, setSelected] = useState(today);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  const weekStart = weekStartOf(selected);

  // The target a week was run at: whatever was pinned to that week, falling
  // back to the current default for weeks that were never pinned.
  const targetFor = useCallback(
    (ws: string) => weekMap[ws]?.daily_target ?? prefTarget,
    [weekMap, prefTarget],
  );
  const dailyTarget = targetFor(weekStart);

  const day = dayMap[selected] ?? emptyDay(userId, selected);
  const summary = useMemo(
    () => summarise(weekStart, dailyTarget, dayMap, today),
    [weekStart, dailyTarget, dayMap, today],
  );

  // ── Saving ──────────────────────────────────────────────────────────────────
  // Counters get tapped fast, so every change lands in local state at once and
  // the rows are flushed together a moment later rather than one request per tap.
  const pendingDays = useRef<Record<string, CallDay>>({});
  const pendingWeeks = useRef<Record<string, CallWeek>>({});
  const pendingPrefs = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const days = Object.values(pendingDays.current);
    const weeks = Object.values(pendingWeeks.current);
    const target = pendingPrefs.current;
    pendingDays.current = {};
    pendingWeeks.current = {};
    pendingPrefs.current = null;
    if (days.length === 0 && weeks.length === 0 && target === null) return;

    if (!schemaReady) {
      setStatus('error');
      setError('Run the v98 migration first — nothing is being saved.');
      return;
    }

    setStatus('saving');
    const results = await Promise.all([
      days.length > 0 ? dbOp('cold_call_days', 'upsert', days.map(dayPayload)) : null,
      weeks.length > 0
        ? dbOp('cold_call_weeks', 'upsert', weeks.map(w => ({ ...w, updated_at: new Date().toISOString() })))
        : null,
      target !== null
        ? dbOp('cold_call_prefs', 'upsert', { user_id: userId, daily_target: target, updated_at: new Date().toISOString() })
        : null,
    ]);
    const failed = results.find(r => r?.error);
    if (failed?.error) {
      setStatus('error');
      setError(failed.error);
      return;
    }
    setStatus('saved');
    setError('');
  }, [schemaReady, userId]);

  const queue = useCallback((parts: { days?: CallDay[]; weeks?: CallWeek[]; prefTarget?: number }) => {
    for (const d of parts.days ?? []) pendingDays.current[d.call_date] = d;
    for (const w of parts.weeks ?? []) pendingWeeks.current[w.week_start] = w;
    if (parts.prefTarget !== undefined) pendingPrefs.current = parts.prefTarget;
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 700);
  }, [flush]);

  // Don't lose the last few taps when the tab is hidden or the page unmounts.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        if (timer.current) clearTimeout(timer.current);
        void flush();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);

  /**
   * Applies a patch to one day, locally and then on the server. The next row is
   * built out here rather than inside the updater: an updater runs during render
   * and queueing from in there would mean a setState mid-render.
   */
  const patchDay = useCallback((date: string, patch: Partial<CallDay>) => {
    const next = { ...(dayMap[date] ?? emptyDay(userId, date)), ...patch };
    setDayMap(prev => ({ ...prev, [date]: next }));
    queue({ days: [next] });
  }, [dayMap, queue, userId]);

  const bump = (key: CounterKey, by: number) =>
    patchDay(selected, { [key]: Math.max(0, (day[key] ?? 0) + by) } as Partial<CallDay>);

  const setCounter = (key: CounterKey, value: number) =>
    patchDay(selected, { [key]: value } as Partial<CallDay>);

  const togglePlanned = (date: string) =>
    patchDay(date, { planned: !(dayMap[date]?.planned ?? false) });

  /** Marks Mon–Fri of a week in one pass; a weekend already marked is kept. */
  const planWeekdays = (ws: string) => {
    const rows = weekDates(ws).slice(0, 5).map(date => ({
      ...(dayMap[date] ?? emptyDay(userId, date)), planned: true,
    }));
    setDayMap(prev => {
      const next = { ...prev };
      for (const r of rows) next[r.call_date] = r;
      return next;
    });
    queue({ days: rows });
  };

  const clearWeek = (ws: string) => {
    const rows = weekDates(ws)
      .filter(date => dayMap[date]?.planned)
      .map(date => ({ ...dayMap[date], planned: false }));
    if (rows.length === 0) return;
    setDayMap(prev => {
      const next = { ...prev };
      for (const r of rows) next[r.call_date] = r;
      return next;
    });
    queue({ days: rows });
  };

  /**
   * Changing the target. A week already in the past keeps the number it was
   * actually run at: before the default moves, every earlier week with activity
   * and no pinned target gets one at the old value, so history stops drifting.
   */
  const changeTarget = (raw: number) => {
    const value = Math.max(0, Math.min(100_000, Math.floor(raw || 0)));
    const editingPast = weekStart < thisWeek;

    const pinned: CallWeek[] = [{
      user_id: userId,
      week_start: weekStart,
      daily_target: value,
      note: weekMap[weekStart]?.note ?? '',
    }];

    if (!editingPast) {
      const active = new Set(
        Object.values(dayMap)
          .filter(d => d.planned || d.calls > 0)
          .map(d => weekStartOf(d.call_date)),
      );
      for (const ws of active) {
        if (ws < thisWeek && !weekMap[ws]) {
          pinned.push({ user_id: userId, week_start: ws, daily_target: prefTarget, note: '' });
        }
      }
    }

    setWeekMap(prev => {
      const next = { ...prev };
      for (const w of pinned) next[w.week_start] = w;
      return next;
    });
    if (!editingPast) setPrefTarget(value);
    queue({ weeks: pinned, ...(editingPast ? {} : { prefTarget: value }) });
  };

  // ── Week on week ────────────────────────────────────────────────────────────
  const recentWeeks = useMemo(() => {
    const starts = new Set<string>([thisWeek, weekStart]);
    for (const d of Object.values(dayMap)) {
      if (d.planned || d.calls > 0) starts.add(weekStartOf(d.call_date));
    }
    return [...starts].sort().reverse().slice(0, 8)
      .map(ws => summarise(ws, targetFor(ws), dayMap, today));
  }, [dayMap, thisWeek, weekStart, targetFor, today]);

  const t = summary.totals;
  const statusLabel = status === 'saving' ? 'Saving…'
    : status === 'saved' ? 'Saved'
    : status === 'error' ? 'Not saved'
    : '';

  return (
    <div className="page-fade">
      {!schemaReady && (
        <div className="pn" style={{ borderColor: 'var(--warn)', background: 'var(--warn-soft)' }}>
          <div className="pn-t">The cold calling tables are not in the database yet</div>
          <div className="pn-s" style={{ marginTop: 4 }}>
            Open Supabase → SQL Editor and run <b>supabase/schema_v98_cold_calling.sql</b>.
            Until then the page works but nothing is kept.
          </div>
        </div>
      )}
      {error && (
        <div className="pn" style={{ borderColor: 'var(--err)', background: 'var(--err-soft)' }}>{error}</div>
      )}

      {/* ── The target, and which week it applies to ── */}
      <div className="pn cc-bar">
        <div className="cc-weeknav">
          <button className="btn btn-sm b-sec" onClick={() => setSelected(addDays(selected, -7))} aria-label="Previous week">‹</button>
          <div>
            <div className="pn-t">{weekLabel(weekStart)}</div>
            <div className="pn-s">
              {weekStart === thisWeek ? 'This week' : weekStart < thisWeek ? 'Past week' : 'Upcoming week'}
            </div>
          </div>
          <button className="btn btn-sm b-sec" onClick={() => setSelected(addDays(selected, 7))} aria-label="Next week">›</button>
          {weekStart !== thisWeek && (
            <button className="btn btn-sm b-sec" onClick={() => setSelected(today)}>This week</button>
          )}
        </div>

        <div className="cc-maths">
          <label className="cc-target">
            <span>Daily target</span>
            <input
              type="number"
              min={0}
              step={10}
              inputMode="numeric"
              value={dailyTarget}
              onChange={e => changeTarget(Number(e.target.value))}
              onFocus={e => e.currentTarget.select()}
            />
          </label>
          <span className="cc-op">×</span>
          <div className="cc-term">
            <span className="cc-term-v">{summary.workingDays}</span>
            <span className="cc-term-l">calling {summary.workingDays === 1 ? 'day' : 'days'}</span>
          </div>
          <span className="cc-op">=</span>
          <div className="cc-term big">
            <span className="cc-term-v">{summary.weeklyTarget.toLocaleString()}</span>
            <span className="cc-term-l">weekly target</span>
          </div>
        </div>

        {statusLabel && (
          <div className={`cc-save ${status}`}>
            {status === 'saving' && <span className="spin" />}{statusLabel}
          </div>
        )}
      </div>

      {/* ── Where the week stands ── */}
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-h">
            <span className="s-ico ind">📞</span>
            {/* Neutral until the target is actually met — a red badge all week
                long would just be noise. */}
            <span className={summary.percent >= 100 ? 'trend t-up' : 'st-chip'}>{summary.percent}%</span>
          </div>
          <div className="s-l">Calls this week</div>
          <div className="s-v">{t.calls.toLocaleString()}</div>
          <div className="bw" style={{ marginTop: 9 }}>
            <div className="bf" style={{ width: `${summary.percent}%`, background: summary.percent >= 100 ? 'var(--ok)' : 'var(--accent)' }} />
          </div>
          <div className="s-s">of {summary.weeklyTarget.toLocaleString()}</div>
        </div>

        <div className="stat">
          <div className="stat-h"><span className="s-ico am">🎯</span></div>
          <div className="s-l">Still to go</div>
          <div className="s-v">{summary.remaining.toLocaleString()}</div>
          <div className="s-s">
            {summary.daysLeft > 0
              ? `${summary.perDayNeeded.toLocaleString()} a day over ${summary.daysLeft} ${summary.daysLeft === 1 ? 'day' : 'days'}`
              : summary.remaining === 0 ? 'Target met' : 'No calling days left'}
          </div>
        </div>

        <div className="stat">
          <div className="stat-h"><span className="s-ico cy">🎙</span></div>
          <div className="s-l">Reached owner</div>
          <div className="s-v">{t.reached_owner.toLocaleString()}</div>
          <div className="s-s">{rate(t.reached_owner, t.calls)} of calls</div>
        </div>

        <div className="stat">
          <div className="stat-h"><span className="s-ico pu">📅</span></div>
          <div className="s-l">Bookings</div>
          <div className="s-v">{t.bookings.toLocaleString()}</div>
          <div className="s-s">{rate(t.bookings, t.reached_owner)} of owners reached</div>
        </div>

        <div className="stat">
          <div className="stat-h"><span className="s-ico gn">🏆</span></div>
          <div className="s-l">Closed deals</div>
          <div className="s-v gn">{t.closed.toLocaleString()}</div>
          <div className="s-s">{rate(t.closed, t.bookings)} of bookings</div>
        </div>
      </div>

      {/* ── The schedule, and the selected day's counters ── */}
      <div className="cc-split">
        {/* Keyed on the selected month so stepping a week over a month boundary
            brings the calendar with it; browsing months inside the panel leaves
            the selection alone and so does not remount it. */}
        <SchedulePanel
          key={selected.slice(0, 7)}
          dayMap={dayMap}
          today={today}
          selected={selected}
          weekStart={weekStart}
          dailyTarget={dailyTarget}
          onSelect={setSelected}
          onTogglePlanned={togglePlanned}
          onPlanWeekdays={planWeekdays}
          onClearWeek={clearWeek}
        />
        <DayCounters
          day={day}
          dailyTarget={dailyTarget}
          isToday={selected === today}
          onBump={bump}
          onSet={setCounter}
          onNote={note => patchDay(selected, { note })}
          onTogglePlanned={() => togglePlanned(selected)}
        />
      </div>

      <WeekBreakdown
        weekStart={weekStart}
        dayMap={dayMap}
        dailyTarget={dailyTarget}
        today={today}
        selected={selected}
        onSelect={setSelected}
      />

      {/* ── Week on week ── */}
      <div className="pn">
        <div className="pn-h">
          <div>
            <div className="pn-t">Week on week</div>
            <div className="pn-s">Each week against the target it was actually run at</div>
          </div>
        </div>
        {recentWeeks.map(w => (
          <button
            key={w.weekStart}
            className={`cc-wk${w.weekStart === weekStart ? ' sel' : ''}`}
            onClick={() => setSelected(w.weekStart === thisWeek ? today : w.weekStart)}
          >
            <span className="cc-wk-l">
              {weekLabel(w.weekStart)}
              {w.weekStart === thisWeek && <span className="st-chip" style={{ marginLeft: 7 }}>this week</span>}
            </span>
            <span className="cc-wk-bar">
              <span className="bw">
                <span className="bf" style={{ width: `${w.percent}%`, background: w.percent >= 100 ? 'var(--ok)' : 'var(--accent)' }} />
              </span>
            </span>
            <span className="cc-wk-n">
              {w.totals.calls.toLocaleString()}<span> / {w.weeklyTarget.toLocaleString()}</span>
            </span>
            <span className="cc-wk-m">{w.totals.bookings} booked · {w.totals.closed} closed</span>
          </button>
        ))}
      </div>
    </div>
  );
}
