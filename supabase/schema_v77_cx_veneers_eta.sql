-- v77: Veneers delivery ETA.
--
-- After the veneers ship, the agent enters the expected delivery date in the
-- "Veneers shipped" stage. When that date arrives the portal auto-advances the
-- case to "Veneers delivered" and the card stamp flips to "Delivered".
--
--   veneers_eta_date — expected delivery date (DATE).
--
-- Idempotent: safe to run more than once. Run in Supabase SQL Editor.

ALTER TABLE public.cx_cases
  ADD COLUMN IF NOT EXISTS veneers_eta_date DATE;

NOTIFY pgrst, 'reload schema';
