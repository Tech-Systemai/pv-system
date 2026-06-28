-- v79: Impression Kit delivery ETA.
--
-- In the "Impression Kit sent" stage the agent enters the estimated date the
-- kit will arrive at the customer. The card UI shows the date with its weekday
-- spelled out automatically (no extra input needed).
--
--   imp_kit_eta_date — expected arrival date at the customer (DATE).
--
-- Idempotent: safe to run more than once. Run in Supabase SQL Editor.

ALTER TABLE public.cx_cases
  ADD COLUMN IF NOT EXISTS imp_kit_eta_date DATE;

NOTIFY pgrst, 'reload schema';
