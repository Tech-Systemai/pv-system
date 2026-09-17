-- v90: Smart Time — brain-dump task triage and a prayer-aware day plan
-- Backs the "Smart Time" section of the portal. You dump raw text (typed or
-- dictated); the parser turns it into scored tasks with time estimates, and the
-- planner lays them out around that day's prayer times. Everything here is
-- per-user and private to that user.
-- Run in Supabase SQL Editor

-- ── Preferences ────────────────────────────────────────────────────────────────
-- One row per user. Holds where prayer times come from, the shape of the day,
-- and the current period state (which swaps Salah blocks for Quran reading).
CREATE TABLE IF NOT EXISTS public.smart_time_prefs (
  user_id            UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  city               TEXT        NOT NULL DEFAULT '',
  country            TEXT        NOT NULL DEFAULT '',
  latitude           NUMERIC,
  longitude          NUMERIC,
  -- Aladhan calculation method id (3 = Muslim World League, 2 = ISNA,
  -- 4 = Umm al-Qura, 5 = Egyptian) and school (0 = Shafi, 1 = Hanafi).
  method             INTEGER     NOT NULL DEFAULT 3,
  school             INTEGER     NOT NULL DEFAULT 0,
  timezone           TEXT        NOT NULL DEFAULT '',
  wake_time          TEXT        NOT NULL DEFAULT '05:00',
  sleep_time         TEXT        NOT NULL DEFAULT '23:00',
  prayer_minutes     INTEGER     NOT NULL DEFAULT 15,
  quran_minutes      INTEGER     NOT NULL DEFAULT 20,
  pomodoro_on        BOOLEAN     NOT NULL DEFAULT TRUE,
  pomodoro_minutes   INTEGER     NOT NULL DEFAULT 25,
  break_minutes      INTEGER     NOT NULL DEFAULT 5,
  meals_on           BOOLEAN     NOT NULL DEFAULT TRUE,
  -- Period state: while active the planner reads Quran in place of Salah and
  -- turns Pomodoro breaks into Quran breaks.
  period_active      BOOLEAN     NOT NULL DEFAULT FALSE,
  period_started_on  DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tasks ──────────────────────────────────────────────────────────────────────
-- One row per thing on your plate. importance/urgency are 0-100 scores the
-- parser assigns; quadrant is the Eisenhower cell they resolve to.
CREATE TABLE IF NOT EXISTS public.smart_time_tasks (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  detail         TEXT        NOT NULL DEFAULT '',
  raw_text       TEXT        NOT NULL DEFAULT '',
  category       TEXT        NOT NULL DEFAULT 'other',
  quadrant       TEXT        NOT NULL DEFAULT 'q2' CHECK (quadrant IN ('q1','q2','q3','q4')),
  importance     INTEGER     NOT NULL DEFAULT 50,
  urgency        INTEGER     NOT NULL DEFAULT 50,
  est_minutes    INTEGER     NOT NULL DEFAULT 30,
  -- TRUE when the dump actually stated a duration, FALSE when we estimated it.
  est_explicit   BOOLEAN     NOT NULL DEFAULT FALSE,
  energy         TEXT        NOT NULL DEFAULT 'shallow' CHECK (energy IN ('deep','shallow','rest')),
  due_on         DATE,
  fixed_time     TEXT        NOT NULL DEFAULT '',
  prayer_anchor  TEXT        NOT NULL DEFAULT '',
  status         TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','dropped')),
  confidence     TEXT        NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  actual_minutes INTEGER     NOT NULL DEFAULT 0,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS smart_time_tasks_user_idx ON public.smart_time_tasks (user_id, status);
CREATE INDEX IF NOT EXISTS smart_time_tasks_due_idx  ON public.smart_time_tasks (user_id, due_on);

-- ── Dumps ──────────────────────────────────────────────────────────────────────
-- The raw text exactly as it came in, plus what the parser made of it. Kept so
-- a bad parse can be re-read later.
CREATE TABLE IF NOT EXISTS public.smart_time_dumps (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  raw_text   TEXT        NOT NULL DEFAULT '',
  source     TEXT        NOT NULL DEFAULT 'typed' CHECK (source IN ('typed','voice')),
  parsed     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  task_count INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS smart_time_dumps_user_idx ON public.smart_time_dumps (user_id, created_at DESC);

-- ── Day plans ──────────────────────────────────────────────────────────────────
-- One generated timeline per user per day. Blocks are stored whole because the
-- planner always regenerates the full day; the PK is composite so an upsert
-- from /api/db replaces the day without needing a conflict target.
CREATE TABLE IF NOT EXISTS public.smart_time_plans (
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_date    DATE        NOT NULL,
  blocks       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  prayer_times JSONB       NOT NULL DEFAULT '{}'::jsonb,
  hijri_date   TEXT        NOT NULL DEFAULT '',
  period_mode  BOOLEAN     NOT NULL DEFAULT FALSE,
  unscheduled  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- /api/db orders selects by created_at, so every table it touches needs one.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, plan_date)
);

-- ── Weekly review (Muhasabah) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.smart_time_reviews (
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start   DATE        NOT NULL,
  done_count   INTEGER     NOT NULL DEFAULT 0,
  open_count   INTEGER     NOT NULL DEFAULT 0,
  done_minutes INTEGER     NOT NULL DEFAULT 0,
  reflection   TEXT        NOT NULL DEFAULT '',
  adjustments  TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, week_start)
);

-- ── Period log ─────────────────────────────────────────────────────────────────
-- Closed periods, so the section can say "day 3" and learn a typical length.
CREATE TABLE IF NOT EXISTS public.smart_time_period_log (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_on DATE        NOT NULL,
  ended_on   DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS smart_time_period_log_user_idx ON public.smart_time_period_log (user_id, started_on DESC);

ALTER TABLE public.smart_time_prefs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_time_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_time_dumps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_time_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_time_reviews    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_time_period_log ENABLE ROW LEVEL SECURITY;

-- This data is personal: every policy is scoped to the row's own owner, and no
-- management role gets a read. Portal writes go through /api/db, which uses the
-- service role and stamps the signed-in user's id.
CREATE POLICY "st_prefs_own"   ON public.smart_time_prefs      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "st_tasks_own"   ON public.smart_time_tasks      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "st_dumps_own"   ON public.smart_time_dumps      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "st_plans_own"   ON public.smart_time_plans      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "st_reviews_own" ON public.smart_time_reviews    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "st_period_own"  ON public.smart_time_period_log FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
