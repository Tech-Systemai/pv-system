-- v81: Lab "Sent to U.S." tracking number.
--
-- In the Lab tab, once a kit/case is marked "Sent to U.S." the team enters the
-- US-leg tracking number right under the US ETA date.
--
--   lab_us_tracking — tracking number for the U.S. leg (TEXT).
--
-- Idempotent: safe to run more than once. Run in Supabase SQL Editor.

ALTER TABLE public.cx_cases
  ADD COLUMN IF NOT EXISTS lab_us_tracking TEXT;

NOTIFY pgrst, 'reload schema';
