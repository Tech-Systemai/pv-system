'use client';

import { useMemo, useState } from 'react';
import { HADITH_MUHASABAH } from '@/lib/smartTime/islamic';
import { minutesLabel } from '@/lib/smartTime/schedule';
import { CATEGORY_ICON, QUADRANT_META, type Category, type Quadrant, type Task } from '@/lib/smartTime/types';

export type Review = {
  user_id: string;
  week_start: string;
  done_count: number;
  open_count: number;
  done_minutes: number;
  reflection: string;
  adjustments: string;
};

type Props = {
  tasks: Task[];
  weekStart: string;
  review: Review | null;
  history: Review[];
  saving: boolean;
  calibration: { factor: number; samples: number } | null;
  onSave: (reflection: string, adjustments: string, stats: { done: number; open: number; minutes: number }) => void;
};

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function ReviewPanel({ tasks, weekStart, review, history, saving, calibration, onSave }: Props) {
  const [reflection, setReflection] = useState(review?.reflection ?? '');
  const [adjustments, setAdjustments] = useState(review?.adjustments ?? '');

  const stats = useMemo(() => {
    const weekStartMs = new Date(`${weekStart}T00:00:00`).getTime();
    const weekEndMs = weekStartMs + 7 * 86_400_000;
    const inWeek = (iso: string | null) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= weekStartMs && t < weekEndMs;
    };

    const done = tasks.filter(t => t.status === 'done' && inWeek(t.completed_at));
    const open = tasks.filter(t => t.status === 'open');
    const doneMinutes = done.reduce((s, t) => s + (t.actual_minutes || t.est_minutes), 0);
    const openMinutes = open.reduce((s, t) => s + t.est_minutes, 0);

    const byCategory: Record<string, number> = {};
    for (const t of done) {
      byCategory[t.category] = (byCategory[t.category] ?? 0) + (t.actual_minutes || t.est_minutes);
    }
    const byQuadrant: Record<Quadrant, number> = { q1: 0, q2: 0, q3: 0, q4: 0 };
    for (const t of done) byQuadrant[t.quadrant] += t.actual_minutes || t.est_minutes;

    const overdue = open.filter(t => t.due_on && t.due_on < weekStart).length;

    return { done, open, doneMinutes, openMinutes, byCategory, byQuadrant, overdue };
  }, [tasks, weekStart]);

  const maxCategory = Math.max(1, ...Object.values(stats.byCategory));
  const quadrantTotal = Math.max(1, Object.values(stats.byQuadrant).reduce((a, b) => a + b, 0));

  return (
    <div>
      <div className="st-quote">
        <div className="st-ar">{HADITH_MUHASABAH.arabic}</div>
        <div className="st-quote-tr">{HADITH_MUHASABAH.translation}</div>
        <div className="st-quote-src">{HADITH_MUHASABAH.source} · muhasabah · week of {fmtDate(weekStart)}</div>
      </div>

      <div className="two-col">
        <div className="card" style={{ padding: 18 }}>
          <div className="card-title">Where the week went</div>
          <div className="card-sub" style={{ marginBottom: 14 }}>
            Finished work only — planned-but-not-done time is not counted.
          </div>

          {stats.done.length === 0 ? (
            <div className="empty">Nothing ticked off yet this week.</div>
          ) : (
            <div className="st-bars">
              {Object.entries(stats.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, mins]) => (
                  <div key={cat} className="hb-row" style={{ marginBottom: 0 }}>
                    <div className="hb-head">
                      <span className="lbl">
                        {CATEGORY_ICON[cat as Category] ?? '•'} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </span>
                      <span className="v">{minutesLabel(mins)}</span>
                    </div>
                    <div className="hb">
                      <div className="hb-f" style={{ width: `${Math.round((mins / maxCategory) * 100)}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--line-2)', marginTop: 16, paddingTop: 14 }}>
            <div className="card-title" style={{ marginBottom: 4 }}>Which quadrant got your hours</div>
            <div className="card-sub" style={{ marginBottom: 12 }}>
              Real progress comes from the second box — important work you did before it caught fire.
            </div>
            <div className="st-bars">
              {(Object.keys(QUADRANT_META) as Quadrant[]).map(q => {
                const mins = stats.byQuadrant[q];
                const pct = Math.round((mins / quadrantTotal) * 100);
                return (
                  <div key={q} className="hb-row" style={{ marginBottom: 0 }}>
                    <div className="hb-head">
                      <span className="lbl">{QUADRANT_META[q].label}</span>
                      <span className="v">{minutesLabel(mins)} · {pct}%</span>
                    </div>
                    <div className="hb">
                      <div
                        className={`hb-f${q === 'q2' ? ' ok' : q === 'q3' || q === 'q4' ? ' warn' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>This week at a glance</div>
            {[
              ['Finished', `${stats.done.length} tasks · ${minutesLabel(stats.doneMinutes)}`],
              ['Still open', `${stats.open.length} tasks · ${minutesLabel(stats.openMinutes)}`],
              ['Past their date', `${stats.overdue} tasks`],
              [
                'Estimate accuracy',
                calibration && calibration.samples >= 5
                  ? `${calibration.factor > 1 ? '+' : ''}${Math.round((calibration.factor - 1) * 100)}% vs planned (${calibration.samples} tasks)`
                  : 'needs a few more finished tasks',
              ],
            ].map(([label, value]) => (
              <div key={label} className="row" style={{ padding: '9px 0' }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{label}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink)' }}>
                  {value}
                </span>
              </div>
            ))}
            {calibration && calibration.samples >= 5 && Math.abs(calibration.factor - 1) > 0.1 && (
              <div className="st-banner info" style={{ marginTop: 12, marginBottom: 0 }}>
                <span>◷</span>
                <div>
                  New estimates are being adjusted by {Math.round((calibration.factor - 1) * 100)}% to match how
                  long things actually take you.
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="card-title" style={{ marginBottom: 4 }}>Muhasabah</div>
            <div className="card-sub" style={{ marginBottom: 12 }}>
              What went well, what slipped, and why.
            </div>
            <label className="st-lbl">Reflection</label>
            <textarea
              className="st-dump"
              style={{ minHeight: 110, fontSize: 13 }}
              value={reflection}
              onChange={e => setReflection(e.target.value)}
              placeholder="I kept Fajr and the morning block, but afternoons kept getting eaten by messages…"
            />
            <label className="st-lbl" style={{ marginTop: 12 }}>Next week I will change</label>
            <textarea
              className="st-dump"
              style={{ minHeight: 80, fontSize: 13 }}
              value={adjustments}
              onChange={e => setAdjustments(e.target.value)}
              placeholder="Batch all replies into one block after Asr."
            />
            <button
              className="btn btn-acc btn-sm"
              style={{ marginTop: 12 }}
              disabled={saving}
              onClick={() =>
                onSave(reflection, adjustments, {
                  done: stats.done.length,
                  open: stats.open.length,
                  minutes: stats.doneMinutes,
                })
              }
            >
              {saving ? <><span className="spin" />Saving…</> : 'Save this review'}
            </button>
          </div>
        </div>
      </div>

      {history.filter(h => h.week_start !== weekStart).length > 0 && (
        <div className="card" style={{ padding: 18, marginTop: 14 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Earlier weeks</div>
          <div className="scrollable">
            {history
              .filter(h => h.week_start !== weekStart)
              .map(h => (
                <div key={h.week_start} className="st-task">
                  <div className="st-task-b">
                    <div className="st-task-t">
                      Week of {fmtDate(h.week_start)} · {h.done_count} finished · {minutesLabel(h.done_minutes)}
                    </div>
                    {h.reflection && <div className="st-why" style={{ fontStyle: 'normal' }}>{h.reflection}</div>}
                    {h.adjustments && <div className="st-why">Change: {h.adjustments}</div>}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
