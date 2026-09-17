'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dbOp } from '@/utils/db';
import { parseDump } from '@/lib/smartTime/parse';
import { buildDayPlan, fmtClock, minutesLabel, planTotals, toMin } from '@/lib/smartTime/schedule';
import { HADITH_FIVE_BEFORE_FIVE, PRAYER_AR, PRAYER_ORDER } from '@/lib/smartTime/islamic';
import {
  CATEGORY_ICON, QUADRANT_META,
  type DayPlan, type DraftTask, type ParseResult,
  type Prefs, type PrayerTimes, type Quadrant, type Task,
} from '@/lib/smartTime/types';
import DayPlanPanel from './DayPlanPanel';
import ReviewPanel, { type Review } from './ReviewPanel';

// Dictation runs on the browser's own speech recognition; it is still vendor
// prefixed in some browsers and missing in others, so it is typed by hand here
// rather than pulled from the DOM lib.
type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};
type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function speechRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Dump = { id: number; raw_text: string; source: string; task_count: number; created_at: string };
type PeriodEntry = { id: number; started_on: string; ended_on: string | null };
type Draft = DraftTask & { include: boolean };
type Tab = 'dump' | 'board' | 'plan' | 'review' | 'settings';

const CALC_METHODS = [
  { value: 3, label: 'Muslim World League' },
  { value: 2, label: 'ISNA (North America)' },
  { value: 4, label: 'Umm al-Qura (Makkah)' },
  { value: 5, label: 'Egyptian General Authority' },
  { value: 1, label: 'University of Islamic Sciences, Karachi' },
  { value: 8, label: 'Gulf Region' },
  { value: 12, label: 'Union des Organisations Islamiques de France' },
];

const PLACEHOLDER = `Just say it all, however it comes out. For example:

i'm on my period this week. need to call the lab about the veneer order tomorrow, takes like 20 min. finish the Q3 report for the boss, big one, due friday. pay the electricity bill asap. reply to 5 client emails. study for my exam for 2 hours tonight. pick up mom's prescription and visit her after maghrib. quick laundry. memorise a new page of Quran. maybe reorganise my desk at some point`;

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Monday of the week a date falls in. */
function weekStartOf(d: Date): string {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
  return ymd(x);
}

/** Current wall-clock time in a named timezone, as HH:MM. */
function clockIn(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  }
}

/**
 * How long things really take this person, as a multiplier on our estimates.
 * Only applied once there is enough finished work to mean something.
 */
function calibrationFrom(tasks: Task[]): { factor: number; samples: number } | null {
  const ratios = tasks
    .filter(t => t.status === 'done' && t.actual_minutes > 0 && t.est_minutes > 0)
    .map(t => t.actual_minutes / t.est_minutes)
    .sort((a, b) => a - b);
  if (ratios.length === 0) return null;
  const median = ratios[Math.floor(ratios.length / 2)];
  return { factor: Math.min(2, Math.max(0.6, median)), samples: ratios.length };
}

export default function SmartTimeClient({
  userId, initialPrefs, initialTasks, initialDumps, initialReviews, initialPeriods, prefsExist,
}: {
  userId: string;
  initialPrefs: Prefs;
  initialTasks: Task[];
  initialDumps: Dump[];
  initialReviews: Review[];
  initialPeriods: PeriodEntry[];
  prefsExist: boolean;
}) {
  const [tab, setTab] = useState<Tab>(prefsExist ? 'dump' : 'settings');
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [dumps, setDumps] = useState<Dump[]>(initialDumps);
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [periods, setPeriods] = useState<PeriodEntry[]>(initialPeriods);

  const [dumpText, setDumpText] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [parseInfo, setParseInfo] = useState<ParseResult | null>(null);
  const [dumpSource, setDumpSource] = useState<'typed' | 'voice'>('typed');

  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes>({});
  const [hijriDate, setHijriDate] = useState('');
  const [place, setPlace] = useState('');
  const [timezone, setTimezone] = useState('');
  const [nowHHMM, setNowHHMM] = useState('');

  const [planning, setPlanning] = useState(false);
  const [prayerError, setPrayerError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');

  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRec | null>(null);
  const spoken = useRef('');

  const today = ymd(new Date());
  const weekStart = weekStartOf(new Date());
  const calibration = useMemo(() => calibrationFrom(tasks), [tasks]);
  const openTasks = useMemo(() => tasks.filter(t => t.status === 'open'), [tasks]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  // The tables land with a migration, so say so plainly instead of failing quietly.
  const noteDbError = (error: string | null) => {
    if (!error) return false;
    const missing = /does not exist|schema cache|relation|could not find the table/i.test(error);
    setSetupError(missing ? 'migration' : error);
    return true;
  };

  // ── Clock in the prayer-times timezone ──────────────────────────────────────
  useEffect(() => {
    const update = () => setNowHHMM(clockIn(timezone));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [timezone]);

  // ── Prayer times ────────────────────────────────────────────────────────────
  const loadPrayerTimes = useCallback(async (): Promise<{ timings: PrayerTimes; hijri: string } | null> => {
    const hasPlace = prefs.city || (prefs.latitude !== null && prefs.longitude !== null);
    if (!hasPlace) {
      setPrayerError('No city set yet.');
      return null;
    }

    const params = new URLSearchParams({
      method: String(prefs.method),
      school: String(prefs.school),
      date: today,
    });
    if (prefs.latitude !== null && prefs.longitude !== null) {
      params.set('lat', String(prefs.latitude));
      params.set('lng', String(prefs.longitude));
    } else {
      params.set('city', prefs.city);
      params.set('country', prefs.country);
    }

    try {
      const res = await fetch(`/api/prayer-times?${params}`);
      const json = await res.json();
      if (!res.ok) { setPrayerError(json.error ?? 'Could not load prayer times.'); return null; }

      setPrayerError('');
      setPrayerTimes(json.timings ?? {});
      setHijriDate(json.hijriDate ?? '');
      setPlace(json.place ?? '');
      setTimezone(json.timezone ?? '');
      return { timings: json.timings ?? {}, hijri: json.hijriDate ?? '' };
    } catch (err) {
      setPrayerError(err instanceof Error ? err.message : 'Could not load prayer times.');
      return null;
    }
  }, [prefs.city, prefs.country, prefs.latitude, prefs.longitude, prefs.method, prefs.school, today]);

  // ── Plan ────────────────────────────────────────────────────────────────────
  const regenerate = useCallback(async (opts?: { tasks?: Task[]; prefs?: Prefs; silent?: boolean }) => {
    setPlanning(true);
    const times = await loadPrayerTimes();
    if (!times) { setPlanning(false); return; }

    const usePrefs = opts?.prefs ?? prefs;
    const useTasks = (opts?.tasks ?? tasks).filter(t => t.status === 'open');
    const next = buildDayPlan({
      prefs: usePrefs,
      prayerTimes: times.timings,
      tasks: useTasks,
      date: today,
      hijriDate: times.hijri,
    });

    setPlan(next);
    const { error: saveError } = await dbOp('smart_time_plans', 'upsert', {
      user_id: userId,
      plan_date: today,
      blocks: next.blocks,
      prayer_times: next.prayer_times,
      hijri_date: next.hijri_date,
      period_mode: next.period_mode,
      unscheduled: next.unscheduled,
      generated_at: new Date().toISOString(),
    });
    noteDbError(saveError);
    setPlanning(false);
    if (!opts?.silent) flash('Plan rebuilt around today’s prayer times');
  }, [loadPrayerTimes, prefs, tasks, today, userId]);

  // On open: use the plan already saved for today if there is one, otherwise
  // build a fresh one.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!prefs.city && prefs.latitude === null) return;
      const { data, error } = await dbOp('smart_time_plans', 'select', undefined, { plan_date: today });
      if (cancelled) return;
      if (error) { noteDbError(error); return; }

      const saved = data?.[0];
      if (saved) {
        setPlan({
          plan_date: saved.plan_date,
          blocks: saved.blocks ?? [],
          prayer_times: saved.prayer_times ?? {},
          hijri_date: saved.hijri_date ?? '',
          period_mode: saved.period_mode ?? false,
          unscheduled: saved.unscheduled ?? [],
        });
        setPrayerTimes(saved.prayer_times ?? {});
        setHijriDate(saved.hijri_date ?? '');
        await loadPrayerTimes();
      } else {
        await regenerate({ silent: true });
      }
    })();

    return () => { cancelled = true; };
    // Runs once per mount; later rebuilds are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dictation ───────────────────────────────────────────────────────────────
  const toggleMic = () => {
    const SR = speechRecognitionCtor();
    if (!SR) {
      flash('This browser will not do dictation — type it instead');
      return;
    }

    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    spoken.current = dumpText ? `${dumpText.trimEnd()} ` : '';

    rec.onresult = (event: SpeechResultEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) spoken.current += `${chunk.trim()} `;
        else interim += chunk;
      }
      setDumpText(spoken.current + interim);
      setDumpSource('voice');
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    rec.start();
    recognition.current = rec;
    setListening(true);
  };

  // ── Period mode ─────────────────────────────────────────────────────────────
  const setPeriod = async (active: boolean, opts?: { silent?: boolean }) => {
    const nextPrefs: Prefs = {
      ...prefs,
      period_active: active,
      period_started_on: active ? (prefs.period_started_on ?? today) : null,
    };
    setPrefs(nextPrefs);

    await dbOp('smart_time_prefs', 'upsert', {
      user_id: userId,
      ...stripPrefs(nextPrefs),
      updated_at: new Date().toISOString(),
    });

    if (active) {
      const alreadyOpen = periods.find(p => !p.ended_on);
      if (!alreadyOpen) {
        const { data } = await dbOp('smart_time_period_log', 'insert', { user_id: userId, started_on: today });
        if (data?.[0]) setPeriods(prev => [data[0] as PeriodEntry, ...prev]);
      }
    } else {
      const openEntry = periods.find(p => !p.ended_on);
      if (openEntry) {
        await dbOp('smart_time_period_log', 'update', { ended_on: today }, { id: openEntry.id });
        setPeriods(prev => prev.map(p => (p.id === openEntry.id ? { ...p, ended_on: today } : p)));
      }
    }

    await regenerate({ prefs: nextPrefs, silent: true });
    if (!opts?.silent) {
      flash(active ? 'Quran reading will stand in for Salah blocks' : 'Back to Salah blocks');
    }
  };

  const periodDay = useMemo(() => {
    if (!prefs.period_active || !prefs.period_started_on) return null;
    const start = new Date(`${prefs.period_started_on}T00:00:00`).getTime();
    return Math.max(1, Math.round((new Date(`${today}T00:00:00`).getTime() - start) / 86_400_000) + 1);
  }, [prefs.period_active, prefs.period_started_on, today]);

  // ── Organise a dump ─────────────────────────────────────────────────────────
  const organize = async () => {
    const raw = dumpText.trim();
    if (!raw) return;

    setBusy('organize');
    const parsed = parseDump(raw, new Date());

    // Lean on how long things actually take this person, not just the rules.
    const factor = calibration && calibration.samples >= 5 ? calibration.factor : 1;
    const adjusted = parsed.tasks.map(t => {
      if (t.est_explicit || factor === 1) return t;
      const scaled = Math.max(5, Math.round((t.est_minutes * factor) / 5) * 5);
      return scaled === t.est_minutes
        ? t
        : {
            ...t,
            est_minutes: scaled,
            reasons: [...t.reasons, `adjusted ${factor > 1 ? 'up' : 'down'} to match your history`],
          };
    });

    setParseInfo({ ...parsed, tasks: adjusted });
    setDrafts(adjusted.map(t => ({ ...t, include: true })));

    const { data } = await dbOp('smart_time_dumps', 'insert', {
      user_id: userId,
      raw_text: raw,
      source: dumpSource,
      parsed: { periodSignal: parsed.periodSignal, dayEnergy: parsed.dayEnergy, tasks: adjusted },
      task_count: adjusted.length,
    });
    if (data?.[0]) setDumps(prev => [data[0] as Dump, ...prev].slice(0, 10));

    // "I'm on my period" in the dump is enough — no toggle hunting.
    if (parsed.periodSignal === true && !prefs.period_active) await setPeriod(true, { silent: true });
    if (parsed.periodSignal === false && prefs.period_active) await setPeriod(false, { silent: true });

    setBusy('');
  };

  const addDrafts = async () => {
    const chosen = drafts.filter(d => d.include);
    if (chosen.length === 0) return;

    setBusy('add');
    const rows = chosen.map(d => ({
      user_id: userId,
      title: d.title,
      detail: d.detail,
      raw_text: d.raw_text,
      category: d.category,
      quadrant: d.quadrant,
      importance: d.importance,
      urgency: d.urgency,
      est_minutes: d.est_minutes,
      est_explicit: d.est_explicit,
      energy: d.energy,
      due_on: d.due_on,
      fixed_time: d.fixed_time,
      prayer_anchor: d.prayer_anchor,
      confidence: d.confidence,
    }));

    const { data, error } = await dbOp('smart_time_tasks', 'insert', rows);
    setBusy('');
    if (error) { noteDbError(error); flash(error); return; }

    const added = (data ?? []) as Task[];
    const nextTasks = [...added, ...tasks];
    setTasks(nextTasks);
    setDrafts([]);
    setParseInfo(null);
    setDumpText('');
    setDumpSource('typed');
    flash(`${added.length} task${added.length === 1 ? '' : 's'} sorted onto your board`);
    await regenerate({ tasks: nextTasks, silent: true });
    setTab('plan');
  };

  // ── Task actions ────────────────────────────────────────────────────────────
  const patchTask = async (id: string, patch: Partial<Task>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch } as Task : t)));
    await dbOp('smart_time_tasks', 'update', { ...patch, updated_at: new Date().toISOString() }, { id });
  };

  const completeTask = async (id: string, actualMinutes: number) => {
    await patchTask(id, {
      status: 'done',
      completed_at: new Date().toISOString(),
      actual_minutes: actualMinutes,
    });
    flash('Ticked off');
  };

  const cycleQuadrant = (t: Task) => {
    const order: Quadrant[] = ['q1', 'q2', 'q3', 'q4'];
    const next = order[(order.indexOf(t.quadrant) + 1) % order.length];
    patchTask(t.id, { quadrant: next });
  };

  const addManual = async (text: string) => {
    const draft = parseDump(text, new Date()).tasks[0];
    if (!draft) return;
    const { data, error } = await dbOp('smart_time_tasks', 'insert', {
      user_id: userId,
      title: draft.title,
      detail: draft.detail,
      raw_text: draft.raw_text,
      category: draft.category,
      quadrant: draft.quadrant,
      importance: draft.importance,
      urgency: draft.urgency,
      est_minutes: draft.est_minutes,
      est_explicit: draft.est_explicit,
      energy: draft.energy,
      due_on: draft.due_on,
      fixed_time: draft.fixed_time,
      prayer_anchor: draft.prayer_anchor,
      confidence: draft.confidence,
    });
    if (error) { flash(error); return; }
    if (data?.[0]) setTasks(prev => [data[0] as Task, ...prev]);
  };

  // ── Settings ────────────────────────────────────────────────────────────────
  const savePrefs = async (next: Prefs) => {
    setBusy('prefs');
    setPrefs(next);
    const { error } = await dbOp('smart_time_prefs', 'upsert', {
      user_id: userId,
      ...stripPrefs(next),
      updated_at: new Date().toISOString(),
    });
    setBusy('');
    if (error) { flash(error); return; }
    flash('Settings saved');
    await regenerate({ prefs: next, silent: true });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { flash('This browser will not share a location'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        savePrefs({
          ...prefs,
          latitude: Number(pos.coords.latitude.toFixed(4)),
          longitude: Number(pos.coords.longitude.toFixed(4)),
        });
      },
      () => flash('Location request was refused'),
    );
  };

  const saveReview = async (reflection: string, adjustments: string, stats: { done: number; open: number; minutes: number }) => {
    setBusy('review');
    const row: Review = {
      user_id: userId,
      week_start: weekStart,
      done_count: stats.done,
      open_count: stats.open,
      done_minutes: stats.minutes,
      reflection,
      adjustments,
    };
    const { error } = await dbOp('smart_time_reviews', 'upsert', { ...row, updated_at: new Date().toISOString() });
    setBusy('');
    if (error) { flash(error); return; }
    setReviews(prev => [row, ...prev.filter(r => r.week_start !== weekStart)]);
    flash('Review saved');
  };

  // ── Derived numbers for the top of the page ─────────────────────────────────
  const nowMin = toMin(nowHHMM);
  const nextPrayer = nextPrayerAfter(prayerTimes, nowMin);

  const stats = useMemo(() => {
    const openMinutes = openTasks.reduce((s, t) => s + t.est_minutes, 0);
    const dueToday = openTasks.filter(t => t.due_on && t.due_on <= today);
    const overdue = openTasks.filter(t => t.due_on && t.due_on < today);
    const totals = plan ? planTotals(plan) : null;
    return { openMinutes, dueToday: dueToday.length, overdue: overdue.length, totals };
  }, [openTasks, plan, today]);

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="page-fade">
      {setupError && (
        <div className="st-banner warn">
          <span>⚠</span>
          <div>
            {setupError === 'migration' ? (
              <>
                <strong>Smart Time tables are not in the database yet.</strong> Open the Supabase SQL
                editor and run <code>supabase/schema_v90_smart_time.sql</code>, then refresh this page.
                Nothing you type here will be saved until then.
              </>
            ) : (
              setupError
            )}
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">🧠</div></div>
          <div className="stat-l">ON YOUR PLATE</div>
          <div className="stat-v">{openTasks.length}</div>
          <div className="stat-foot">{minutesLabel(stats.openMinutes)} of work, as estimated</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className={`stat-ico ${stats.overdue > 0 ? 'er' : 'wn'}`}>⏱</div></div>
          <div className="stat-l">DUE TODAY</div>
          <div className="stat-v">{stats.dueToday}</div>
          <div className="stat-foot">
            {stats.overdue > 0 ? `${stats.overdue} already past their date` : 'Nothing overdue'}
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">◷</div></div>
          <div className="stat-l">PLANNED FOCUS</div>
          <div className="stat-v">{stats.totals ? minutesLabel(stats.totals.focus) : '—'}</div>
          <div className="stat-foot">
            {stats.totals ? `${minutesLabel(stats.totals.worship)} worship · ${minutesLabel(stats.totals.open)} spare` : 'No plan built yet'}
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico">{prefs.period_active ? '📖' : '🕌'}</div></div>
          <div className="stat-l">{prefs.period_active ? 'QURAN MODE' : 'NEXT PRAYER'}</div>
          <div className="stat-v">
            {prefs.period_active
              ? `Day ${periodDay ?? 1}`
              : nextPrayer ? fmtClock(prayerTimes[nextPrayer.name] ?? '') : '—'}
          </div>
          <div className="stat-foot">
            {prefs.period_active
              ? 'Reading in place of Salah'
              : nextPrayer
                ? `${nextPrayer.name} · in ${minutesLabel(nextPrayer.in)}`
                : 'Set your city to see prayer times'}
          </div>
        </div>
      </div>

      {/* ── Prayer strip ── */}
      {Object.keys(prayerTimes).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="st-strip">
            {PRAYER_ORDER.map(name => {
              const at = toMin(prayerTimes[name]);
              const isNext = nextPrayer?.name === name;
              const passed = at !== null && nowMin !== null && at < nowMin && !isNext;
              return (
                <div key={name} className={`st-pill${isNext ? ' next' : ''}${passed ? ' passed' : ''}`}>
                  <div className="st-pill-n">
                    <span>{name}</span>
                    <span className="st-pill-ar">{PRAYER_AR[name]}</span>
                  </div>
                  <div className="st-pill-t">{fmtClock(prayerTimes[name] ?? '')}</div>
                </div>
              );
            })}
          </div>
          {prefs.period_active && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8 }}>
              Period mode · these five slots hold Quran reading instead of Salah, and your breaks are Quran too.
              <button
                className="btn btn-sm btn-ghost"
                style={{ marginLeft: 8 }}
                onClick={() => setPeriod(false)}
              >
                My period ended
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="tabs">
        {([
          ['dump', 'Brain dump'],
          ['board', 'Priorities'],
          ['plan', "Today's plan"],
          ['review', 'Weekly review'],
          ['settings', 'Settings'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Brain dump ── */}
      {tab === 'dump' && (
        <div>
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div className="card-title">Say everything that is on your plate</div>
            <div className="card-sub" style={{ marginBottom: 12 }}>
              Type it or talk it — one long mess is fine. It gets cut into tasks, weighed for
              importance and urgency, and given a time estimate each. Mention your period and the
              day rearranges itself.
            </div>

            <textarea
              className="st-dump"
              value={dumpText}
              onChange={e => setDumpText(e.target.value)}
              placeholder={PLACEHOLDER}
            />

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              <button
                className={`st-mic${listening ? ' on' : ''}`}
                onClick={toggleMic}
                title={listening ? 'Stop dictation' : 'Dictate'}
                aria-label="Dictate"
              >
                {listening ? '■' : '🎙'}
              </button>
              <button className="btn btn-acc" onClick={organize} disabled={!dumpText.trim() || busy === 'organize'}>
                {busy === 'organize' ? <><span className="spin" />Reading it…</> : 'Organise this'}
              </button>
              {dumpText && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setDumpText(''); setDrafts([]); setParseInfo(null); }}>
                  Clear
                </button>
              )}
              <span style={{ fontSize: 11.5, color: 'var(--ink-4)', marginLeft: 'auto' }}>
                {listening ? 'Listening… speak naturally, it keeps up' : `${dumpText.trim().split(/\s+/).filter(Boolean).length} words`}
              </span>
            </div>
          </div>

          {parseInfo && (
            <>
              {parseInfo.periodSignal === true && (
                <div className="st-banner ok">
                  <span>📖</span>
                  <div>
                    Noted — period mode is on. The five prayer slots now hold Quran reading instead of Salah,
                    and every focus break is a Quran break. Say &ldquo;my period is over&rdquo; in a later dump
                    and it switches back on its own.
                  </div>
                </div>
              )}
              {parseInfo.periodSignal === false && (
                <div className="st-banner info">
                  <span>🕌</span>
                  <div>Period mode is off again — Salah blocks are back in the plan.</div>
                </div>
              )}
              {parseInfo.dayEnergy === 'low' && (
                <div className="st-banner warn">
                  <span>◔</span>
                  <div>
                    You said you are running on empty, so focus sittings are shorter and breaks longer today.
                    Heavy work is kept to the stretch after Fajr.
                  </div>
                </div>
              )}
              {parseInfo.notes.length > 0 && (
                <div className="st-banner info">
                  <span>✎</span>
                  <div>
                    Read as context, not tasks: {parseInfo.notes.map(n => `“${n}”`).join(', ')}
                  </div>
                </div>
              )}
            </>
          )}

          {drafts.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <div>
                  <div className="card-title">
                    {drafts.length} task{drafts.length === 1 ? '' : 's'} found
                    {' · '}{minutesLabel(drafts.filter(d => d.include).reduce((s, d) => s + d.est_minutes, 0))} of work
                  </div>
                  <div className="card-sub">Change anything that reads wrong, then add them.</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => { setDrafts([]); setParseInfo(null); }}>
                    Discard
                  </button>
                  <button className="btn btn-acc btn-sm" onClick={addDrafts} disabled={busy === 'add'}>
                    {busy === 'add' ? <><span className="spin" />Adding…</> : `Add ${drafts.filter(d => d.include).length} tasks`}
                  </button>
                </div>
              </div>

              {drafts.map((d, i) => (
                <div key={`${d.title}-${i}`} className={`st-draft${d.include ? '' : ' off'}`}>
                  <div className="st-draft-g">
                    <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={d.include}
                        onChange={e => setDrafts(prev => prev.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                        style={{ accentColor: 'var(--accent)', width: 15, height: 15, flexShrink: 0 }}
                      />
                      <input
                        className="fld-input"
                        style={{ width: '100%' }}
                        value={d.title}
                        onChange={e => setDrafts(prev => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <input
                        className="fld-input"
                        type="number"
                        min={5}
                        step={5}
                        value={d.est_minutes}
                        onChange={e => setDrafts(prev => prev.map((x, j) => (j === i ? { ...x, est_minutes: Math.max(5, Number(e.target.value)) } : x)))}
                        style={{ width: 62 }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>min</span>
                    </div>
                    <select
                      className="fld-input"
                      value={d.quadrant}
                      onChange={e => setDrafts(prev => prev.map((x, j) => (j === i ? { ...x, quadrant: e.target.value as Quadrant } : x)))}
                    >
                      {(Object.keys(QUADRANT_META) as Quadrant[]).map(q => (
                        <option key={q} value={q}>{QUADRANT_META[q].short}</option>
                      ))}
                    </select>
                    <input
                      className="fld-input"
                      type="date"
                      value={d.due_on ?? ''}
                      onChange={e => setDrafts(prev => prev.map((x, j) => (j === i ? { ...x, due_on: e.target.value || null } : x)))}
                    />
                  </div>
                  <div className="st-why">
                    {CATEGORY_ICON[d.category]} {d.category} · {d.est_explicit ? 'you gave the time' : 'time estimated'}
                    {d.reasons.length > 0 && ` · ${d.reasons.join(' · ')}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {dumps.length > 0 && drafts.length === 0 && (
            <div className="card" style={{ padding: 18 }}>
              <div className="card-title" style={{ marginBottom: 10 }}>Earlier dumps</div>
              <div className="scrollable">
                {dumps.map(d => (
                  <div key={d.id} className="st-task">
                    <div className="st-task-b">
                      <div className="st-task-t" style={{ color: 'var(--ink-2)' }}>{d.raw_text}</div>
                      <div className="st-task-m">
                        <span className="st-chip">{d.task_count} tasks</span>
                        <span className="st-chip">{d.source === 'voice' ? 'spoken' : 'typed'}</span>
                        <span className="st-chip">
                          {new Date(d.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={() => { setDumpText(d.raw_text); setTab('dump'); }}>
                      Reuse
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Priorities board ── */}
      {tab === 'board' && (
        <PriorityBoard
          tasks={openTasks}
          onComplete={id => completeTask(id, 0)}
          onDrop={id => patchTask(id, { status: 'dropped' })}
          onCycle={cycleQuadrant}
          onPatch={patchTask}
          onAdd={addManual}
          today={today}
        />
      )}

      {/* ── Today's plan ── */}
      {tab === 'plan' && (
        <DayPlanPanel
          plan={plan}
          prefs={prefs}
          tasks={tasks}
          place={place}
          loading={planning}
          error={prayerError}
          nowHHMM={nowHHMM}
          dateLabel={dateLabel}
          onRegenerate={() => regenerate()}
          onCompleteTask={completeTask}
          onOpenSettings={() => setTab('settings')}
        />
      )}

      {/* ── Weekly review ── */}
      {tab === 'review' && (
        <ReviewPanel
          tasks={tasks}
          weekStart={weekStart}
          review={reviews.find(r => r.week_start === weekStart) ?? null}
          history={reviews}
          saving={busy === 'review'}
          calibration={calibration}
          onSave={saveReview}
        />
      )}

      {/* ── Settings ── */}
      {tab === 'settings' && (
        <SettingsPanel
          prefs={prefs}
          saving={busy === 'prefs'}
          place={place}
          hijriDate={hijriDate}
          prayerError={prayerError}
          periodDay={periodDay}
          periods={periods}
          onSave={savePrefs}
          onUseLocation={useMyLocation}
          onSetPeriod={setPeriod}
        />
      )}

      {toast && <div className="tst">{toast}</div>}
    </div>
  );
}

/** The prefs columns, without the id that /api/db stamps on for us. */
function stripPrefs(p: Prefs): Omit<Prefs, 'user_id'> {
  const rest = { ...p } as Partial<Prefs>;
  delete rest.user_id;
  return rest as Omit<Prefs, 'user_id'>;
}

/** The first prayer still to come today, or tomorrow's Fajr after Isha. */
function nextPrayerAfter(times: PrayerTimes, nowMin: number | null) {
  if (nowMin === null) return null;
  for (const name of PRAYER_ORDER) {
    const at = toMin(times[name]);
    if (at !== null && at > nowMin) return { name, at, in: at - nowMin };
  }
  const fajr = toMin(times.Fajr);
  return fajr === null ? null : { name: 'Fajr' as const, at: fajr, in: 1440 - nowMin + fajr };
}

// ── Priorities board ─────────────────────────────────────────────────────────

function PriorityBoard({
  tasks, today, onComplete, onDrop, onCycle, onPatch, onAdd,
}: {
  tasks: Task[];
  today: string;
  onComplete: (id: string) => void;
  onDrop: (id: string) => void;
  onCycle: (t: Task) => void;
  onPatch: (id: string, patch: Partial<Task>) => void;
  onAdd: (text: string) => void;
}) {
  const [manual, setManual] = useState('');

  return (
    <div>
      <div className="st-quote">
        <div className="st-ar">{HADITH_FIVE_BEFORE_FIVE.arabic}</div>
        <div className="st-quote-tr">{HADITH_FIVE_BEFORE_FIVE.translation}</div>
        <div className="st-quote-src">{HADITH_FIVE_BEFORE_FIVE.source}</div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <input
            className="fld-input"
            style={{ flex: 1, minWidth: 220 }}
            placeholder="One more thing — e.g. “call the clinic tomorrow, 15 min”"
            value={manual}
            onChange={e => setManual(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && manual.trim()) { onAdd(manual.trim()); setManual(''); }
            }}
          />
          <button
            className="btn btn-sm"
            disabled={!manual.trim()}
            onClick={() => { onAdd(manual.trim()); setManual(''); }}
          >
            Add
          </button>
        </div>
      </div>

      <div className="st-board">
        {(Object.keys(QUADRANT_META) as Quadrant[]).map(q => {
          const inQuadrant = tasks
            .filter(t => t.quadrant === q)
            .sort((a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999') || b.urgency - a.urgency);
          const minutes = inQuadrant.reduce((s, t) => s + t.est_minutes, 0);

          return (
            <div key={q} className={`st-quad ${q}`}>
              <div className="st-quad-h">
                <div className="st-quad-t">{QUADRANT_META[q].short}</div>
                <div className="st-quad-n">{inQuadrant.length} · {minutesLabel(minutes)}</div>
              </div>
              <div className="st-quad-a">{QUADRANT_META[q].label} — {QUADRANT_META[q].advice}</div>

              {inQuadrant.length === 0 ? (
                <div className="empty" style={{ padding: 16 }}>Empty</div>
              ) : (
                inQuadrant.map(t => {
                  const late = t.due_on && t.due_on < today;
                  const dueToday = t.due_on === today;
                  return (
                    <div key={t.id} className="st-task">
                      <div className="st-chk" role="button" title="Mark done" onClick={() => onComplete(t.id)} />
                      <div className="st-task-b">
                        <div className="st-task-t">{CATEGORY_ICON[t.category]} {t.title}</div>
                        <div className="st-task-m">
                          <span className={`st-chip${t.est_explicit ? '' : ' est'}`}>{minutesLabel(t.est_minutes)}</span>
                          {t.due_on && (
                            <span className={`st-chip${late ? ' err' : dueToday ? ' warn' : ''}`}>
                              {late ? 'overdue ' : dueToday ? 'today' : ''}
                              {!dueToday && new Date(`${t.due_on}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          {t.fixed_time && <span className="st-chip">{fmtClock(t.fixed_time)}</span>}
                          {t.prayer_anchor && <span className="st-chip">{t.prayer_anchor}</span>}
                          {t.energy === 'deep' && <span className="st-chip">deep work</span>}
                        </div>
                        {t.raw_text && t.raw_text.toLowerCase() !== t.title.toLowerCase() && (
                          <div className="st-why">“{t.raw_text}”</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button className="btn btn-sm btn-ghost" title="Move to the next quadrant" onClick={() => onCycle(t)}>⤵</button>
                        <button
                          className="btn btn-sm btn-ghost"
                          title="Adjust the estimate"
                          onClick={() => {
                            const value = window.prompt(`How long does “${t.title}” really take, in minutes?`, String(t.est_minutes));
                            const minutes = Number(value);
                            if (Number.isFinite(minutes) && minutes >= 5) {
                              onPatch(t.id, { est_minutes: Math.round(minutes), est_explicit: true });
                            }
                          }}
                        >
                          ◷
                        </button>
                        <button className="btn btn-sm btn-ghost" title="Drop it" onClick={() => onDrop(t.id)}>✕</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

function SettingsPanel({
  prefs, saving, place, hijriDate, prayerError, periodDay, periods, onSave, onUseLocation, onSetPeriod,
}: {
  prefs: Prefs;
  saving: boolean;
  place: string;
  hijriDate: string;
  prayerError: string;
  periodDay: number | null;
  periods: PeriodEntry[];
  onSave: (p: Prefs) => void;
  onUseLocation: () => void;
  onSetPeriod: (active: boolean) => void;
}) {
  const [form, setForm] = useState<Prefs>(prefs);
  const set = <K extends keyof Prefs>(key: K, value: Prefs[K]) => setForm(prev => ({ ...prev, [key]: value }));

  const lastClosed = periods.find(p => p.ended_on);

  return (
    <div className="two-col">
      <div>
        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div className="card-title">Where your prayer times come from</div>
          <div className="card-sub" style={{ marginBottom: 14 }}>
            Times are looked up from the Aladhan service for this place and cached for the day.
            {place && ` Currently using ${place}.`}
            {hijriDate && ` Today is ${hijriDate}.`}
          </div>

          {prayerError && (
            <div className="st-banner warn"><span>⚠</span><div>{prayerError}</div></div>
          )}

          <div className="st-fieldrow">
            <div>
              <label className="st-lbl">City</label>
              <input className="fld-input" style={{ width: '100%' }} value={form.city} onChange={e => set('city', e.target.value)} placeholder="Cairo" />
            </div>
            <div>
              <label className="st-lbl">Country</label>
              <input className="fld-input" style={{ width: '100%' }} value={form.country} onChange={e => set('country', e.target.value)} placeholder="Egypt" />
            </div>
          </div>

          <div className="st-fieldrow" style={{ marginTop: 12 }}>
            <div>
              <label className="st-lbl">Latitude (optional, wins over city)</label>
              <input
                className="fld-input" style={{ width: '100%' }} type="number" step="0.0001"
                value={form.latitude ?? ''}
                onChange={e => set('latitude', e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="st-lbl">Longitude</label>
              <input
                className="fld-input" style={{ width: '100%' }} type="number" step="0.0001"
                value={form.longitude ?? ''}
                onChange={e => set('longitude', e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
          </div>

          <div className="st-fieldrow" style={{ marginTop: 12 }}>
            <div>
              <label className="st-lbl">Calculation method</label>
              <select className="fld-input" style={{ width: '100%' }} value={form.method} onChange={e => set('method', Number(e.target.value))}>
                {CALC_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="st-lbl">Asr calculation</label>
              <select className="fld-input" style={{ width: '100%' }} value={form.school} onChange={e => set('school', Number(e.target.value))}>
                <option value={0}>Standard (Shafi, Maliki, Hanbali)</option>
                <option value={1}>Hanafi</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn btn-acc btn-sm" onClick={() => onSave(form)} disabled={saving}>
              {saving ? <><span className="spin" />Saving…</> : 'Save settings'}
            </button>
            <button className="btn btn-sm" onClick={onUseLocation}>Use my current location</button>
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="card-title">The shape of your day</div>
          <div className="card-sub" style={{ marginBottom: 14 }}>
            Work is placed between the prayers: heavy things in the fresh stretch after Fajr, lighter
            things through the Dhuhr and Asr dip, people and rest after Maghrib.
          </div>

          <div className="st-fieldrow">
            <div>
              <label className="st-lbl">Wake</label>
              <input className="fld-input" style={{ width: '100%' }} type="time" value={form.wake_time} onChange={e => set('wake_time', e.target.value)} />
            </div>
            <div>
              <label className="st-lbl">Sleep</label>
              <input className="fld-input" style={{ width: '100%' }} type="time" value={form.sleep_time} onChange={e => set('sleep_time', e.target.value)} />
            </div>
            <div>
              <label className="st-lbl">Minutes per prayer</label>
              <input className="fld-input" style={{ width: '100%' }} type="number" min={5} step={5} value={form.prayer_minutes} onChange={e => set('prayer_minutes', Number(e.target.value))} />
            </div>
            <div>
              <label className="st-lbl">Minutes per Quran sitting</label>
              <input className="fld-input" style={{ width: '100%' }} type="number" min={5} step={5} value={form.quran_minutes} onChange={e => set('quran_minutes', Number(e.target.value))} />
            </div>
            <div>
              <label className="st-lbl">Focus sitting</label>
              <input className="fld-input" style={{ width: '100%' }} type="number" min={15} step={5} value={form.pomodoro_minutes} onChange={e => set('pomodoro_minutes', Number(e.target.value))} />
            </div>
            <div>
              <label className="st-lbl">Break</label>
              <input className="fld-input" style={{ width: '100%' }} type="number" min={3} step={1} value={form.break_minutes} onChange={e => set('break_minutes', Number(e.target.value))} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
            <label className="st-toggle">
              <input type="checkbox" checked={form.pomodoro_on} onChange={e => set('pomodoro_on', e.target.checked)} />
              Split long tasks into focus sittings with a dhikr break between
            </label>
            <label className="st-toggle">
              <input type="checkbox" checked={form.meals_on} onChange={e => set('meals_on', e.target.checked)} />
              Keep meal blocks in the plan
            </label>
          </div>

          <button className="btn btn-acc btn-sm" style={{ marginTop: 14 }} onClick={() => onSave(form)} disabled={saving}>
            {saving ? <><span className="spin" />Saving…</> : 'Save settings'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 18, alignSelf: 'start' }}>
        <div className="card-title">Period</div>
        <div className="card-sub" style={{ marginBottom: 14 }}>
          While this is on, the five prayer slots hold Quran reading instead of Salah and focus breaks
          become Quran breaks. Mentioning it in a brain dump flips this for you.
        </div>

        {prefs.period_active ? (
          <>
            <div className="st-banner ok" style={{ marginBottom: 12 }}>
              <span>📖</span>
              <div>
                On since {prefs.period_started_on ? new Date(`${prefs.period_started_on}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'today'}
                {periodDay ? ` · day ${periodDay}` : ''}.
              </div>
            </div>
            <button className="btn btn-sm" onClick={() => onSetPeriod(false)}>My period ended</button>
          </>
        ) : (
          <button className="btn btn-sm" onClick={() => onSetPeriod(true)}>I&apos;m on my period</button>
        )}

        {periods.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="st-lbl">History</div>
            {periods.map(p => (
              <div key={p.id} className="row" style={{ padding: '7px 0', fontSize: 12, color: 'var(--ink-2)' }}>
                <span>{new Date(`${p.started_on}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                  {p.ended_on
                    ? `${Math.max(1, Math.round((new Date(p.ended_on).getTime() - new Date(p.started_on).getTime()) / 86_400_000) + 1)} days`
                    : 'ongoing'}
                </span>
              </div>
            ))}
            {lastClosed && (
              <div className="st-why" style={{ marginTop: 8 }}>
                Kept only so the day counter and the length history are right.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
