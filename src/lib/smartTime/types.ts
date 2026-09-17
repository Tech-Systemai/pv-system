// Shared shapes for the Smart Time section: the brain-dump parser, the day
// planner and the UI all speak these types.

export type Quadrant = 'q1' | 'q2' | 'q3' | 'q4';
export type Energy   = 'deep' | 'shallow' | 'rest';
export type Confidence = 'high' | 'medium' | 'low';

export type Category =
  | 'work' | 'study' | 'deen' | 'home' | 'family' | 'health'
  | 'finance' | 'admin' | 'errand' | 'social' | 'self' | 'rest' | 'other';

export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

/** A task as stored in smart_time_tasks. */
export type Task = {
  id: string;
  user_id: string;
  title: string;
  detail: string;
  raw_text: string;
  category: Category;
  quadrant: Quadrant;
  importance: number;
  urgency: number;
  est_minutes: number;
  est_explicit: boolean;
  energy: Energy;
  due_on: string | null;      // YYYY-MM-DD
  fixed_time: string;         // HH:MM, '' when the task floats
  prayer_anchor: string;      // e.g. 'after Fajr', '' when unanchored
  status: 'open' | 'done' | 'dropped';
  confidence: Confidence;
  actual_minutes: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** What the parser produces for one item before it becomes a row. */
export type DraftTask = {
  title: string;
  detail: string;
  raw_text: string;
  category: Category;
  quadrant: Quadrant;
  importance: number;
  urgency: number;
  est_minutes: number;
  est_explicit: boolean;
  energy: Energy;
  due_on: string | null;
  fixed_time: string;
  prayer_anchor: string;
  confidence: Confidence;
  /** Short human notes on how we read it — shown under the draft card. */
  reasons: string[];
};

/** Everything a single dump told us, not just the tasks. */
export type ParseResult = {
  tasks: DraftTask[];
  /** true = "I'm on my period", false = "my period ended", null = not mentioned. */
  periodSignal: boolean | null;
  /** 'low' when the dump says they're drained; shortens deep blocks. */
  dayEnergy: 'low' | 'normal' | 'high';
  /** Lines we read as context rather than tasks, echoed back to the user. */
  notes: string[];
};

export type Prefs = {
  user_id: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  method: number;
  school: number;
  timezone: string;
  wake_time: string;
  sleep_time: string;
  prayer_minutes: number;
  quran_minutes: number;
  pomodoro_on: boolean;
  pomodoro_minutes: number;
  break_minutes: number;
  meals_on: boolean;
  period_active: boolean;
  period_started_on: string | null;
};

export const DEFAULT_PREFS: Omit<Prefs, 'user_id'> = {
  city: '',
  country: '',
  latitude: null,
  longitude: null,
  method: 3,
  school: 0,
  timezone: '',
  wake_time: '05:00',
  sleep_time: '23:00',
  prayer_minutes: 15,
  quran_minutes: 20,
  pomodoro_on: true,
  pomodoro_minutes: 25,
  break_minutes: 5,
  meals_on: true,
  period_active: false,
  period_started_on: null,
};

export type PrayerTimes = Partial<Record<PrayerName | 'Sunrise' | 'Sunset', string>>;

export type BlockKind =
  | 'prayer' | 'quran' | 'task' | 'break' | 'meal' | 'wind-down' | 'sleep' | 'free';

/** One row of the generated day timeline. */
export type Block = {
  start: string;         // HH:MM
  end: string;           // HH:MM
  minutes: number;
  kind: BlockKind;
  label: string;
  taskId?: string;
  category?: Category;
  quadrant?: Quadrant;
  /** Arabic text to render with the block (verse, dhikr, hadith). */
  arabic?: string;
  /** Plain-English line under the label. */
  note?: string;
  /** "2 of 4" when a task was split into Pomodoro sittings. */
  part?: string;
};

export type DayPlan = {
  plan_date: string;
  blocks: Block[];
  prayer_times: PrayerTimes;
  hijri_date: string;
  period_mode: boolean;
  /** Tasks that did not fit in the day, with why. */
  unscheduled: { taskId: string; title: string; est_minutes: number }[];
};

export const QUADRANT_META: Record<Quadrant, { label: string; short: string; advice: string; badge: string }> = {
  q1: {
    label: 'Urgent + important',
    short: 'Do now',
    advice: 'Clear these first — they are on fire and they matter.',
    badge: 'pv-bdg-red',
  },
  q2: {
    label: 'Important, not urgent',
    short: 'Schedule',
    advice: 'Where your real progress lives. Give these your best hours.',
    badge: 'pv-bdg-indigo',
  },
  q3: {
    label: 'Urgent, not important',
    short: 'Delegate or batch',
    advice: 'Someone is waiting, but it does not move you. Batch or hand off.',
    badge: 'pv-bdg-amber',
  },
  q4: {
    label: 'Neither',
    short: 'Drop or fill-in',
    advice: 'Only if there is time left over. Dropping these is allowed.',
    badge: 'pv-bdg-gray',
  },
};

export const CATEGORY_ICON: Record<Category, string> = {
  work: '💼', study: '📚', deen: '🕌', home: '🏠', family: '👨‍👩‍👧',
  health: '🩺', finance: '💵', admin: '🗂', errand: '🚗', social: '☕',
  self: '🌿', rest: '😴', other: '•',
};
