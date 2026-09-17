// Day planner for Smart Time.
//
// Prayer times are the fixed points of the day, so they are laid down first and
// everything else fills the gaps between them (Quran sittings take their place
// while a period is active). Within each gap, the task that best suits that
// part of the day wins: deep work in the fresh stretch after Fajr, light and
// shallow work through the Dhuhr–Asr dip, people and rest after Maghrib.

import { DHIKR, PRAYER_ORDER, PRAYER_WEIGHT, quranSittingFor, VERSE_RECITE } from './islamic';
import type { Block, DayPlan, PrayerName, PrayerTimes, Prefs, Quadrant, Task } from './types';

// ── Time helpers ──────────────────────────────────────────────────────────────

/** "05:12", "05:12 (BST)" and "5:12 am" all come back as minutes from midnight. */
export function toMin(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const mer = m[3]?.toLowerCase();
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  return h * 60 + Number(m[2]);
}

export function fromMin(min: number): string {
  const wrapped = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

export function minutesLabel(total: number): string {
  if (total <= 0) return '0m';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** 12-hour display, used everywhere times are shown. */
export function fmtClock(hhmm: string): string {
  const min = toMin(hhmm);
  if (min === null) return hhmm;
  const h24 = Math.floor(min / 60) % 24;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(min % 60).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

// ── Planner ───────────────────────────────────────────────────────────────────

type Anchor = { start: number; end: number; block: Omit<Block, 'start' | 'end' | 'minutes'> };
type Chunk = { task: Task; minutes: number; index: number; total: number };
type Profile = 'peak' | 'light' | 'personal';

const QUADRANT_WEIGHT: Record<Quadrant, number> = { q1: 4, q2: 3, q3: 2, q4: 1 };

export type PlanInput = {
  prefs: Prefs;
  prayerTimes: PrayerTimes;
  tasks: Task[];
  /** YYYY-MM-DD */
  date: string;
  hijriDate?: string;
  /** Overrides prefs.period_active for a one-off preview. */
  periodMode?: boolean;
  dayEnergy?: 'low' | 'normal' | 'high';
};

export function buildDayPlan(input: PlanInput): DayPlan {
  const { prefs, prayerTimes, date } = input;
  const periodMode = input.periodMode ?? prefs.period_active;
  const lowEnergy = input.dayEnergy === 'low';

  const wake = toMin(prefs.wake_time) ?? 300;
  let sleep = toMin(prefs.sleep_time) ?? 1380;
  if (sleep <= wake) sleep += 1440;             // a bedtime past midnight

  const anchors: Anchor[] = [];
  const prayerStart: Partial<Record<PrayerName, number>> = {};

  // ── 1. Prayer (or Quran) anchors ────────────────────────────────────────────
  PRAYER_ORDER.forEach((prayer, i) => {
    const at = toMin(prayerTimes[prayer]);
    if (at === null) return;
    const start = at < wake && at + 1440 < sleep ? at + 1440 : at;
    prayerStart[prayer] = start;

    if (periodMode) {
      const minutes = round5(prefs.quran_minutes);
      anchors.push({
        start,
        end: start + minutes,
        block: {
          kind: 'quran',
          label: `Quran reading · in place of ${prayer}`,
          note: quranSittingFor(i),
          arabic: VERSE_RECITE.arabic,
          category: 'deen',
        },
      });
    } else {
      const minutes = round5(prefs.prayer_minutes * PRAYER_WEIGHT[prayer]);
      anchors.push({
        start,
        end: start + minutes,
        block: { kind: 'prayer', label: `${prayer} prayer`, category: 'deen' },
      });
    }
  });

  // ── 2. Meals, hung off the prayers they sit beside ──────────────────────────
  if (prefs.meals_on) {
    const fajr = anchors.find(a => a.block.label.includes('Fajr'));
    const dhuhr = anchors.find(a => a.block.label.includes('Dhuhr'));
    const maghrib = anchors.find(a => a.block.label.includes('Maghrib'));
    const meal = (start: number, minutes: number, label: string) =>
      anchors.push({ start, end: start + minutes, block: { kind: 'meal', label } });

    if (fajr) meal(Math.max(fajr.end, wake) + 60, 25, 'Breakfast');
    if (dhuhr) meal(dhuhr.end, 30, 'Lunch');
    if (maghrib) meal(maghrib.end, 40, 'Dinner');
  }

  // ── 3. Tasks with a clock time of their own are fixed points too ────────────
  const open = input.tasks.filter(t => t.status === 'open');
  const pinned = open.filter(t => t.fixed_time && toMin(t.fixed_time) !== null);
  for (const t of pinned) {
    const start = toMin(t.fixed_time)!;
    anchors.push({
      start,
      end: start + t.est_minutes,
      block: {
        kind: 'task',
        label: t.title,
        taskId: t.id,
        category: t.category,
        quadrant: t.quadrant,
        note: 'fixed time',
      },
    });
  }

  // Resolve overlaps. A prayer never moves off its own time, and neither does
  // an appointment you were given a time for — so when those two collide the
  // clash is stated rather than hidden. Meals just slide.
  const fixedInPlace = (a: Anchor) =>
    a.block.kind === 'prayer' || a.block.kind === 'quran' || a.block.note === 'fixed time';

  anchors.sort((a, b) => a.start - b.start);
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1];
    const here = anchors[i];
    if (here.start >= prev.end) continue;

    if (!fixedInPlace(here)) {
      const shift = prev.end - here.start;
      here.start += shift;
      here.end += shift;
    } else if (!fixedInPlace(prev)) {
      prev.end = here.start;                     // trim the meal, keep the prayer
    } else if (here.block.kind === 'prayer' || here.block.kind === 'quran') {
      here.block.note = `overlaps ${prev.block.label} — catch it as soon as you are free`;
    }
  }

  // ── 4. Gaps between anchors are what we have to work with ───────────────────
  const windDown = 30;
  const dayEnd = Math.max(wake, sleep - windDown);
  const segments: { start: number; end: number; profile: Profile }[] = [];
  let cursor = wake;
  for (const a of anchors) {
    if (a.start > cursor) segments.push({ start: cursor, end: Math.min(a.start, dayEnd), profile: 'peak' });
    cursor = Math.max(cursor, a.end);
  }
  if (cursor < dayEnd) segments.push({ start: cursor, end: dayEnd, profile: 'peak' });

  const dhuhrAt = prayerStart.Dhuhr ?? 720;
  const maghribAt = prayerStart.Maghrib ?? 1080;
  for (const s of segments) {
    s.profile = s.start >= maghribAt ? 'personal' : s.start >= dhuhrAt ? 'light' : 'peak';
  }
  const usable = segments.filter(s => s.end - s.start >= 10);

  // ── 5. Split the remaining tasks into sittings ──────────────────────────────
  const pomodoro = prefs.pomodoro_on ? Math.max(15, lowEnergy ? prefs.pomodoro_minutes - 10 : prefs.pomodoro_minutes) : 0;
  const breakLen = lowEnergy ? prefs.break_minutes + 5 : prefs.break_minutes;

  const queue: Chunk[] = [];
  for (const t of open) {
    if (pinned.includes(t)) continue;

    // Only head work gets broken into sittings. Splitting the gym run or a
    // trip to the pharmacy into Pomodoros would be nonsense.
    const splittable = pomodoro > 0 && t.energy === 'deep' && t.est_minutes > pomodoro + 10;
    if (!splittable) {
      queue.push({ task: t, minutes: t.est_minutes, index: 1, total: 1 });
      continue;
    }

    const total = Math.ceil(t.est_minutes / pomodoro);
    const each = Math.min(pomodoro, Math.ceil(t.est_minutes / total / 5) * 5);
    const last = t.est_minutes - each * (total - 1);
    const count = last >= 5 ? total : total - 1;
    for (let i = 0; i < count; i++) {
      const minutes = i === count - 1 ? t.est_minutes - each * i : each;
      queue.push({ task: t, minutes, index: i + 1, total: count });
    }
  }

  const placed = new Set<Chunk>();
  const blocks: Block[] = [];
  let dhikrIndex = 0;
  let quranIndex = 3;

  const fitScore = (chunk: Chunk, profile: Profile, segStart: number): number => {
    const t = chunk.task;
    let score = QUADRANT_WEIGHT[t.quadrant] * 100 + t.urgency;
    if (t.due_on === date) score += 80;
    else if (t.due_on && t.due_on < date) score += 120;          // already late

    if (profile === 'peak' && t.energy === 'deep') score += 60;
    if (profile === 'peak' && t.quadrant === 'q1') score += 40;
    if (profile === 'light' && t.energy === 'shallow') score += 45;
    if (profile === 'light' && t.energy === 'deep') score -= 25;
    if (profile === 'personal') {
      score += ['family', 'social', 'self', 'rest', 'deen'].includes(t.category) ? 70 : 0;
      if (t.energy === 'deep') score -= 40;
    }

    // Honour "after Maghrib" / "before Dhuhr" from the dump.
    const anchorMatch = t.prayer_anchor.match(/^(after|before|between)\s+(\w+)/i);
    if (anchorMatch) {
      const at = prayerStart[(anchorMatch[2].charAt(0).toUpperCase() + anchorMatch[2].slice(1).toLowerCase()) as PrayerName];
      if (at !== undefined) {
        if (anchorMatch[1].toLowerCase() === 'before') score += segStart < at ? 300 : -600;
        else score += segStart >= at ? 300 : -600;
      }
    }
    // Keep a split task in order.
    return score - (chunk.index - 1) * 5;
  };

  for (const seg of usable) {
    let at = seg.start;
    let workedSinceBreak = 0;

    for (;;) {
      const remaining = seg.end - at;
      if (remaining < 10) break;

      // Only the earliest unplaced sitting of each task is eligible.
      const nextOf = new Map<string, Chunk>();
      for (const c of queue) {
        if (placed.has(c)) continue;
        const current = nextOf.get(c.task.id);
        if (!current || c.index < current.index) nextOf.set(c.task.id, c);
      }
      const eligible = [...nextOf.values()].filter(c => c.minutes <= remaining);
      if (eligible.length === 0) break;

      eligible.sort((a, b) => fitScore(b, seg.profile, seg.start) - fitScore(a, seg.profile, seg.start));
      const chosen = eligible[0];

      // A break is earned by a full sitting's worth of work, not by every small
      // errand — dhikr normally, Quran while on period.
      if (prefs.pomodoro_on && workedSinceBreak >= pomodoro && remaining >= chosen.minutes + breakLen + 5) {
        const quote = periodMode ? VERSE_RECITE : DHIKR[dhikrIndex++ % DHIKR.length];
        blocks.push({
          start: fromMin(at),
          end: fromMin(at + breakLen),
          minutes: breakLen,
          kind: 'break',
          label: periodMode ? 'Quran break' : 'Dhikr break',
          note: periodMode ? quranSittingFor(quranIndex++) : quote.translation,
          arabic: quote.arabic,
        });
        at += breakLen;
        workedSinceBreak = 0;
      }

      blocks.push({
        start: fromMin(at),
        end: fromMin(at + chosen.minutes),
        minutes: chosen.minutes,
        kind: 'task',
        label: chosen.task.title,
        taskId: chosen.task.id,
        category: chosen.task.category,
        quadrant: chosen.task.quadrant,
        part: chosen.total > 1 ? `sitting ${chosen.index} of ${chosen.total}` : undefined,
        note: chosen.task.est_explicit ? undefined : 'estimated',
      });
      at += chosen.minutes;
      workedSinceBreak += chosen.minutes;
      placed.add(chosen);
    }

    // Anything left in this gap is honestly open time.
    if (seg.end - at >= 20) {
      blocks.push({
        start: fromMin(at),
        end: fromMin(seg.end),
        minutes: seg.end - at,
        kind: 'free',
        label: 'Open time',
        note: seg.profile === 'personal' ? 'rest, family, or get ahead' : 'buffer for overruns',
      });
    }
  }

  // ── 6. Anchors, wind-down, and what did not fit ─────────────────────────────
  for (const a of anchors) {
    blocks.push({ ...a.block, start: fromMin(a.start), end: fromMin(a.end), minutes: a.end - a.start });
  }

  blocks.push({
    start: fromMin(dayEnd),
    end: fromMin(sleep),
    minutes: sleep - dayEnd,
    kind: 'wind-down',
    label: periodMode ? 'Wind down · Quran or dhikr' : 'Wind down · dhikr before sleep',
    note: 'Screens away, tomorrow gets planned in the morning',
  });

  // Blocks that land after midnight belong at the end of the list, not the top.
  // The day starts at whichever comes first, waking up or Fajr.
  const dayFloor = Math.min(wake % 1440, ...anchors.map(a => a.start % 1440));
  const adj = (m: number) => (m < dayFloor ? m + 1440 : m);
  blocks.sort((a, b) => adj(toMin(a.start) ?? 0) - adj(toMin(b.start) ?? 0));

  const leftovers = new Map<string, { taskId: string; title: string; est_minutes: number }>();
  for (const c of queue) {
    if (placed.has(c)) continue;
    const existing = leftovers.get(c.task.id);
    if (existing) existing.est_minutes += c.minutes;
    else leftovers.set(c.task.id, { taskId: c.task.id, title: c.task.title, est_minutes: c.minutes });
  }

  return {
    plan_date: date,
    blocks,
    prayer_times: prayerTimes,
    hijri_date: input.hijriDate ?? '',
    period_mode: periodMode,
    unscheduled: [...leftovers.values()],
  };
}

/** Totals for the stat cards above the timeline. */
export function planTotals(plan: DayPlan) {
  const focus = plan.blocks.filter(b => b.kind === 'task').reduce((s, b) => s + b.minutes, 0);
  const worship = plan.blocks
    .filter(b => b.kind === 'prayer' || b.kind === 'quran' || b.kind === 'break')
    .reduce((s, b) => s + b.minutes, 0);
  const open = plan.blocks.filter(b => b.kind === 'free').reduce((s, b) => s + b.minutes, 0);
  const overflow = plan.unscheduled.reduce((s, t) => s + t.est_minutes, 0);
  return { focus, worship, open, overflow };
}
