'use client';

import { PRAYER_AR, PRAYER_ORDER, VERSE_PRAYER_TIMES } from '@/lib/smartTime/islamic';
import { fmtClock, minutesLabel, toMin } from '@/lib/smartTime/schedule';
import type { PrayerName, PrayerTimes } from '@/lib/smartTime/types';

type Props = {
  times: PrayerTimes;
  /** Current time where the times were calculated, as HH:MM. */
  nowHHMM: string;
  place: string;
  hijriDate: string;
  methodName: string;
  timezone: string;
  periodMode: boolean;
  periodDay: number | null;
  loading: boolean;
  error: string;
  onEndPeriod: () => void;
  onOpenSettings: () => void;
};

/** Which prayer we are in now, and which is next. */
function positions(times: PrayerTimes, nowMin: number | null) {
  if (nowMin === null) return { current: null, next: null, until: 0 };

  let current: PrayerName | null = null;
  let next: PrayerName | null = null;

  for (const name of PRAYER_ORDER) {
    const at = toMin(times[name]);
    if (at === null) continue;
    if (at <= nowMin) current = name;
    else if (!next) next = name;
  }

  // After Isha the next one is tomorrow's Fajr.
  const nextAt = next ? toMin(times[next]) : toMin(times.Fajr);
  const until = nextAt === null ? 0 : next ? nextAt - nowMin : 1440 - nowMin + nextAt;
  return { current, next: next ?? (times.Fajr ? ('Fajr' as PrayerName) : null), until };
}

export default function PrayerBar({
  times, nowHHMM, place, hijriDate, methodName, timezone,
  periodMode, periodDay, loading, error, onEndPeriod, onOpenSettings,
}: Props) {
  const nowMin = toMin(nowHHMM);
  const { current, next, until } = positions(times, nowMin);
  const hasTimes = PRAYER_ORDER.some(p => times[p]);
  const sunrise = times.Sunrise;

  return (
    <div className="st-prayer-card">
      <div className="st-prayer-top">
        <div style={{ minWidth: 0 }}>
          <div className="st-prayer-place">
            <span>🕌</span>
            <span>{place || 'No location set'}</span>
            <button className="st-prayer-edit" onClick={onOpenSettings}>change</button>
          </div>
          <div className="st-prayer-sub">
            {[
              hijriDate,
              methodName && `${methodName}`,
              timezone && timezone.replace('_', ' '),
            ].filter(Boolean).join(' · ') || 'Loading prayer times…'}
          </div>
        </div>

        {hasTimes && next && (
          <div className="st-prayer-next">
            <div className="st-prayer-next-l">
              {periodMode ? 'Next Quran sitting' : 'Next prayer'}
            </div>
            <div className="st-prayer-next-v">
              {next} <span className="st-pill-ar">{PRAYER_AR[next]}</span>
            </div>
            <div className="st-prayer-next-t">
              {fmtClock(times[next] ?? '')} · in {minutesLabel(until)}
            </div>
          </div>
        )}
      </div>

      {error && !hasTimes ? (
        <div className="st-banner warn" style={{ marginBottom: 0 }}>
          <span>⚠</span>
          <div>
            {error}
            <button className="btn btn-sm" style={{ marginLeft: 10 }} onClick={onOpenSettings}>
              Open settings
            </button>
          </div>
        </div>
      ) : !hasTimes ? (
        <div className="st-strip">
          {PRAYER_ORDER.map(name => (
            <div key={name} className="st-pill passed">
              <div className="st-pill-n">
                <span>{name}</span>
                <span className="st-pill-ar">{PRAYER_AR[name]}</span>
              </div>
              <div className="st-pill-t">{loading ? '· · ·' : '—'}</div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="st-strip">
            {PRAYER_ORDER.map(name => {
              const at = toMin(times[name]);
              const isNext = next === name && current !== name;
              const isCurrent = current === name;
              const passed = at !== null && nowMin !== null && at <= nowMin && !isCurrent;
              return (
                <div
                  key={name}
                  className={`st-pill${isNext ? ' next' : ''}${isCurrent ? ' current' : ''}${passed ? ' passed' : ''}`}
                >
                  <div className="st-pill-n">
                    <span>{name}</span>
                    <span className="st-pill-ar">{PRAYER_AR[name]}</span>
                  </div>
                  <div className="st-pill-t">{fmtClock(times[name] ?? '')}</div>
                  {isCurrent && <div className="st-pill-tag">now</div>}
                  {isNext && <div className="st-pill-tag next">up next</div>}
                  {periodMode && <div className="st-pill-tag quran">Quran</div>}
                </div>
              );
            })}
          </div>

          <div className="st-prayer-foot">
            <div className="st-ar sm" style={{ flex: 1, minWidth: 220 }}>{VERSE_PRAYER_TIMES.arabic}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {sunrise && <span className="st-chip">sunrise {fmtClock(sunrise)}</span>}
              {periodMode ? (
                <>
                  <span className="st-chip est">
                    Quran instead of Salah{periodDay ? ` · day ${periodDay}` : ''}
                  </span>
                  <button className="btn btn-sm btn-ghost" onClick={onEndPeriod}>My period ended</button>
                </>
              ) : (
                <span className="st-chip">{VERSE_PRAYER_TIMES.source}</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
