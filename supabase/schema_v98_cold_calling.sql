-- v98: Cold Calling — a daily call target, the week's calling days, and the
-- counters you tap while you dial.
-- Backs the "Cold Calling" section of the portal. You set a daily target, pick
-- the days you are actually going to call that week, and the weekly target
-- falls out of the two. Everything here is per-user and private to that user.
-- Run in Supabase SQL Editor

-- ── Preferences ────────────────────────────────────────────────────────────────
-- One row per user. Holds the default daily target that new weeks start from.
CREATE TABLE IF NOT EXISTS public.cold_call_prefs (
  user_id      UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  daily_target INTEGER     NOT NULL DEFAULT 250,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Weeks ──────────────────────────────────────────────────────────────────────
-- One row per user per week, keyed on the Monday that starts it. daily_target is
-- a snapshot: raising the target in November must not rewrite what October's
-- weekly target was. The weekly target is this number times however many days
-- are marked as calling days in cold_call_days — it is never stored, because a
-- stored copy would drift the moment a day is added or dropped.
CREATE TABLE IF NOT EXISTS public.cold_call_weeks (
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start   DATE        NOT NULL,
  daily_target INTEGER     NOT NULL DEFAULT 250,
  note         TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Composite PK so an upsert from /api/db replaces the week without needing a
  -- conflict target of its own.
  PRIMARY KEY (user_id, week_start)
);

-- ── Days ───────────────────────────────────────────────────────────────────────
-- One row per user per date. `planned` is the calendar picker: TRUE means "I am
-- cold calling this day", which is what makes it count towards the week's
-- working days. The counters are the outcome of the calls actually made, and a
-- day can carry numbers even when it was never planned — a day you called
-- anyway still belongs in the totals.
CREATE TABLE IF NOT EXISTS public.cold_call_days (
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_date      DATE        NOT NULL,
  planned        BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Every dial that connected to the dialler, answered or not.
  calls          INTEGER     NOT NULL DEFAULT 0 CHECK (calls          >= 0),
  -- Got the decision maker on the line.
  reached_owner  INTEGER     NOT NULL DEFAULT 0 CHECK (reached_owner  >= 0),
  bookings       INTEGER     NOT NULL DEFAULT 0 CHECK (bookings       >= 0),
  closed         INTEGER     NOT NULL DEFAULT 0 CHECK (closed         >= 0),
  no_answer      INTEGER     NOT NULL DEFAULT 0 CHECK (no_answer      >= 0),
  not_interested INTEGER     NOT NULL DEFAULT 0 CHECK (not_interested >= 0),
  note           TEXT        NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, call_date)
);

CREATE INDEX IF NOT EXISTS cold_call_days_user_idx ON public.cold_call_days (user_id, call_date DESC);

ALTER TABLE public.cold_call_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cold_call_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cold_call_days  ENABLE ROW LEVEL SECURITY;

-- These numbers are personal: every policy is scoped to the row's own owner and
-- no management role gets a read. Portal writes go through /api/db, which uses
-- the service role and stamps the signed-in user's id.
DROP POLICY IF EXISTS "cc_prefs_own" ON public.cold_call_prefs;
DROP POLICY IF EXISTS "cc_weeks_own" ON public.cold_call_weeks;
DROP POLICY IF EXISTS "cc_days_own"  ON public.cold_call_days;

CREATE POLICY "cc_prefs_own" ON public.cold_call_prefs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cc_weeks_own" ON public.cold_call_weeks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cc_days_own"  ON public.cold_call_days  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
