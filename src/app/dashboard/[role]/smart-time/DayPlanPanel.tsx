'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DHIKR, VERSE_PRAYER_TIMES, VERSE_RECITE } from '@/lib/smartTime/islamic';
import { fmtClock, minutesLabel, planTotals, toMin } from '@/lib/smartTime/schedule';
import { CATEGORY_ICON, type Block, type DayPlan, type Prefs, type Task } from '@/lib/smartTime/types';

type Props = {
  plan: DayPlan | null;
  prefs: Prefs;
  tasks: Task[];
  place: string;
  loading: boolean;
  error: string;
  /** Current time where the prayer times are calculated, as HH:MM. */
  nowHHMM: string;
  dateLabel: string;
  onRegenerate: () => void;
  onCompleteTask: (taskId: string, actualMinutes: number) => void;
  onOpenSettings: () => void;
};

type Phase = 'work' | 'break';

export default function DayPlanPanel({
  plan, prefs, tasks, place, loading, error, nowHHMM, dateLabel,
  onRegenerate, onCompleteTask, onOpenSettings,
}: Props) {
  const [focus, setFocus] = useState<{ block: Block; phase: Phase; left: number; running: boolean } | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const taskById = useMemo(() => Object.fromEntries(tasks.map(t => [t.id, t])), [tasks]);
  const totals = plan ? planTotals(plan) : null;
  const nowMin = toMin(nowHHMM);

  // ── Focus timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tick.current) { clearInterval(tick.current); tick.current = null; }
    if (!focus?.running) return;

    tick.current = setInterval(() => {
      setFocus(prev => {
        if (!prev || !prev.running) return prev;
        if (prev.left > 1) return { ...prev, left: prev.left - 1 };
        // A finished sitting rolls straight into its break.
        if (prev.phase === 'work') {
          return { ...prev, phase: 'break', left: Math.max(1, prefs.break_minutes) * 60, running: true };
        }
        return { ...prev, running: false, left: 0 };
      });
    }, 1000);

    return () => { if (tick.current) clearInterval(tick.current); };
  }, [focus?.running, focus?.phase, prefs.break_minutes]);

  const startFocus = (block: Block) => {
    if (block.kind !== 'task' || !block.taskId) return;
    setFocus({ block, phase: 'work', left: block.minutes * 60, running: true });
  };

  const breakQuote = plan?.period_mode
    ? VERSE_RECITE
    : DHIKR[(focus?.block.minutes ?? 0) % DHIKR.length];

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Empty and error states ──────────────────────────────────────────────────
  if (!plan && !loading) {
    return (
      <div className="card" style={{ padding: 18 }}>
        {error ? (
          <div className="st-banner warn">
            <span>⚠</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Prayer times unavailable</div>
              <div>{error}</div>
              <button className="btn btn-sm" style={{ marginTop: 9 }} onClick={onOpenSettings}>
                Open settings
              </button>
            </div>
          </div>
        ) : (
          <div className="empty">
            No plan yet. Set your city in settings, then generate today&apos;s plan.
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-acc btn-sm" onClick={onOpenSettings}>Set my city</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="st-quote">
        <div className="st-ar">{VERSE_PRAYER_TIMES.arabic}</div>
        <div className="st-quote-tr">{VERSE_PRAYER_TIMES.translation}</div>
        <div className="st-quote-src">{VERSE_PRAYER_TIMES.source} · the day is built around these five</div>
      </div>

      {/* ── Header ── */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{dateLabel}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
              {[plan?.hijri_date, place].filter(Boolean).join(' · ') || 'Location not set'}
              {plan?.period_mode && ' · Quran in place of Salah'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {totals && (
              <span className="st-chip">
                {minutesLabel(totals.focus)} focus · {minutesLabel(totals.worship)} worship · {minutesLabel(totals.open)} open
              </span>
            )}
            <button className="btn btn-acc btn-sm" onClick={onRegenerate} disabled={loading}>
              {loading ? <><span className="spin" />Planning…</> : 'Rebuild plan'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Focus timer ── */}
      {focus && (
        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div className="st-lbl" style={{ marginBottom: 2 }}>
                {focus.phase === 'work' ? 'Focus sitting' : plan?.period_mode ? 'Quran break' : 'Dhikr break'}
              </div>
              <div className={`st-timer${focus.phase === 'break' ? ' break' : ''}`}>{mmss(focus.left)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{focus.block.label}</div>
              {focus.phase === 'break' ? (
                <>
                  <div className="st-ar sm" style={{ marginTop: 6 }}>{breakQuote.arabic}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{breakQuote.translation}</div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                  {focus.block.part ?? `${minutesLabel(focus.block.minutes)} planned`}
                  {' · '}Phone away until the timer ends.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={() => setFocus(f => (f ? { ...f, running: !f.running } : f))}>
                {focus.running ? 'Pause' : 'Resume'}
              </button>
              {focus.block.taskId && (
                <button
                  className="btn btn-sm btn-acc"
                  onClick={() => {
                    const spent = Math.max(1, Math.round((focus.block.minutes * 60 - (focus.phase === 'work' ? focus.left : 0)) / 60));
                    onCompleteTask(focus.block.taskId!, spent);
                    setFocus(null);
                  }}
                >
                  Done
                </button>
              )}
              <button className="btn btn-sm btn-ghost" onClick={() => setFocus(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      <div className="card" style={{ padding: 18 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Today, block by block</div>
        <div className="st-tl">
          {(plan?.blocks ?? []).map((b, i) => {
            const task = b.taskId ? taskById[b.taskId] : undefined;
            const done = task?.status === 'done';
            const startMin = toMin(b.start) ?? 0;
            const prevMin = i > 0 ? toMin(plan!.blocks[i - 1].start) ?? 0 : -1;
            const showNow = nowMin !== null && nowMin >= prevMin && nowMin < startMin && i > 0;

            return (
              <div key={`${b.start}-${i}`}>
                {showNow && (
                  <div className="st-now">
                    <div className="st-now-t">now {fmtClock(nowHHMM)}</div>
                    <div className="st-now-l" />
                  </div>
                )}
                <div className={`st-row st-k-${b.kind}${done ? ' st-done' : ''}`}>
                  <div className="st-row-time">
                    {fmtClock(b.start)}
                    <span>{fmtClock(b.end)}</span>
                  </div>
                  <div className="st-bar" />
                  <div
                    className="st-card"
                    onClick={() => b.kind === 'task' && !done && startFocus(b)}
                    role={b.kind === 'task' ? 'button' : undefined}
                    tabIndex={b.kind === 'task' ? 0 : undefined}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span className="st-card-l">
                        {b.category && b.kind === 'task' ? `${CATEGORY_ICON[b.category]} ` : ''}
                        {b.label}
                      </span>
                      {b.part && <span className="st-chip">{b.part}</span>}
                      {b.note === 'estimated' && <span className="st-chip est">estimated</span>}
                      {b.kind === 'task' && !done && <span className="st-chip">tap to focus</span>}
                      {done && <span className="st-chip">done</span>}
                    </div>
                    {b.arabic && <div className="st-ar sm" style={{ marginTop: 5 }}>{b.arabic}</div>}
                    {b.note && b.note !== 'estimated' && <div className="st-card-s">{b.note}</div>}
                  </div>
                  <div className="st-row-m">{minutesLabel(b.minutes)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {plan && plan.blocks.length === 0 && (
          <div className="empty">Nothing planned — add some tasks and rebuild the plan.</div>
        )}
      </div>

      {/* ── Overflow ── */}
      {plan && plan.unscheduled.length > 0 && (
        <div className="card" style={{ padding: 18, marginTop: 14 }}>
          <div className="card-title">Did not fit today</div>
          <div className="card-sub" style={{ marginBottom: 10 }}>
            {minutesLabel(plan.unscheduled.reduce((s, t) => s + t.est_minutes, 0))} more than the day holds.
            These stay on your list for tomorrow — or drop the ones in the bottom-right quadrant.
          </div>
          {plan.unscheduled.map(u => (
            <div key={u.taskId} className="st-task">
              <div className="st-task-b">
                <div className="st-task-t">{u.title}</div>
                <div className="st-task-m"><span className="st-chip">{minutesLabel(u.est_minutes)} left</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
