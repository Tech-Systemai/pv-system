// Shared shapes for the Cold Calling section: the schedule picker, the counters
// and the week summary all speak these types.

/** A day as stored in cold_call_days. */
export type CallDay = {
  user_id: string;
  call_date: string;          // YYYY-MM-DD
  planned: boolean;           // marked in the calendar as a calling day
  calls: number;
  reached_owner: number;
  bookings: number;
  closed: number;
  no_answer: number;
  not_interested: number;
  note: string;
  created_at?: string;
  updated_at?: string;
};

/** A week as stored in cold_call_weeks, keyed on the Monday that starts it. */
export type CallWeek = {
  user_id: string;
  week_start: string;         // YYYY-MM-DD, always a Monday
  daily_target: number;
  note: string;
};

export type CallPrefs = {
  user_id: string;
  daily_target: number;
};

export const DEFAULT_DAILY_TARGET = 250;

/** The counter keys, in the order they are shown. */
export const COUNTERS = [
  { key: 'calls',          label: 'Total calls',    short: 'Calls',    icon: '📞', tone: 'ind', hint: 'Every number you dialled' },
  { key: 'reached_owner',  label: 'Reached owner',  short: 'Owner',    icon: '🎙', tone: 'cy',  hint: 'Got the decision maker on the line' },
  { key: 'bookings',       label: 'Bookings',       short: 'Booked',   icon: '📅', tone: 'pu',  hint: 'Appointments set' },
  { key: 'closed',         label: 'Closed deals',   short: 'Closed',   icon: '🏆', tone: 'gn',  hint: 'Signed and done' },
  { key: 'no_answer',      label: 'No answers',     short: 'No ans.',  icon: '🔇', tone: 'am',  hint: 'Rang out, voicemail, dead line' },
  { key: 'not_interested', label: 'Not interested', short: 'Not int.', icon: '✕',  tone: 'rd',  hint: 'A clear no' },
] as const;

export type CounterKey = typeof COUNTERS[number]['key'];

export const COUNTER_KEYS = COUNTERS.map(c => c.key) as readonly CounterKey[];

/** A zeroed day, used for any date with no row yet. */
export function emptyDay(userId: string, date: string): CallDay {
  return {
    user_id: userId, call_date: date, planned: false,
    calls: 0, reached_owner: 0, bookings: 0, closed: 0,
    no_answer: 0, not_interested: 0, note: '',
  };
}

// ── Dates ────────────────────────────────────────────────────────────────────
// Everything here works on local YYYY-MM-DD strings. Dates are never parsed
// with `new Date('2026-11-08')`, which UTC-shifts and can land on the wrong day
// west of Greenwich; `T00:00:00` is appended so the browser reads it as local.

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseYmd = (s: string) => new Date(`${s}T00:00:00`);

export const addDays = (s: string, n: number) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

/** The Monday of the week a date falls in. */
export function weekStartOf(date: string): string {
  const d = parseYmd(date);
  const offset = (d.getDay() + 6) % 7;        // Monday = 0
  d.setDate(d.getDate() - offset);
  return ymd(d);
}

/** The seven dates of a week, Monday first. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** The 6×7 grid of dates covering a month, Monday first. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => ymd(new Date(year, month, 1 - offset + i)));
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const dayLabel = (date: string) =>
  parseYmd(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const longDayLabel = (date: string) =>
  parseYmd(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

/** "3 – 9 Nov" for a week, collapsing the month when both ends share it. */
export function weekLabel(weekStart: string): string {
  const a = parseYmd(weekStart);
  const b = parseYmd(addDays(weekStart, 6));
  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  const right = b.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const year = a.getFullYear() === b.getFullYear() && a.getFullYear() === new Date().getFullYear()
    ? '' : ` ${b.getFullYear()}`;
  return `${left} – ${right}${year}`;
}

// ── Totals ───────────────────────────────────────────────────────────────────

export type Totals = Record<CounterKey, number>;

export const zeroTotals = (): Totals =>
  Object.fromEntries(COUNTER_KEYS.map(k => [k, 0])) as Totals;

export function sumDays(days: CallDay[]): Totals {
  const out = zeroTotals();
  for (const d of days) for (const k of COUNTER_KEYS) out[k] += d[k] ?? 0;
  return out;
}

/** What a week adds up to, against the target its planned days imply. */
export type WeekSummary = {
  weekStart: string;
  dailyTarget: number;
  /** Days marked as calling days. */
  workingDays: number;
  /** dailyTarget × workingDays. */
  weeklyTarget: number;
  totals: Totals;
  /** Calls still to make to hit the weekly target. */
  remaining: number;
  /** 0–100, capped so a big week does not stretch the bar off the card. */
  percent: number;
  /** Calls per remaining planned day needed to still land on target. */
  perDayNeeded: number;
  /** Planned days that have not happened yet, today included. */
  daysLeft: number;
};

export function summarise(
  weekStart: string,
  dailyTarget: number,
  dayMap: Record<string, CallDay>,
  today: string,
): WeekSummary {
  const dates = weekDates(weekStart);
  const days = dates.map(d => dayMap[d]).filter(Boolean) as CallDay[];
  const planned = dates.filter(d => dayMap[d]?.planned);
  const workingDays = planned.length;
  const weeklyTarget = workingDays * dailyTarget;
  const totals = sumDays(days);
  const remaining = Math.max(0, weeklyTarget - totals.calls);
  const daysLeft = planned.filter(d => d >= today).length;
  return {
    weekStart, dailyTarget, workingDays, weeklyTarget, totals, remaining, daysLeft,
    percent: weeklyTarget > 0 ? Math.min(100, Math.round((totals.calls / weeklyTarget) * 100)) : 0,
    perDayNeeded: daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining,
  };
}

/** A percentage as a short string, or '—' when the denominator is zero. */
export function rate(top: number, bottom: number): string {
  if (!bottom) return '—';
  return `${Math.round((top / bottom) * 100)}%`;
}
