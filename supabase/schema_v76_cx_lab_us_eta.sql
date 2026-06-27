-- v76: Second ETA for the lab flow — when the kit will arrive back in the U.S.
--
-- There are now two ETAs on a case:
--   * lab_eta_date    (v74) — when the kit will arrive AT THE LAB ("Lab ETA").
--   * lab_us_eta_date (this) — when the kit will be back IN THE U.S. ("US ETA"),
--     captured in the Lab tab when the lab marks "Sent to U.S.".
--
-- Idempotent: safe to run more than once. Run in Supabase SQL Editor.

ALTER TABLE public.cx_cases
  ADD COLUMN IF NOT EXISTS lab_us_eta_date DATE;

NOTIFY pgrst, 'reload schema';
