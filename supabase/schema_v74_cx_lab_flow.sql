-- v74: Lab intake flow for impression kits.
--
-- Adds the two fields the CX "Lab" tab needs:
--   * lab_eta_date — the date an agent expects the kit to reach the lab, set with
--     the date picker in the "IMP kit on the way to lab" stage. A non-null value
--     is what surfaces the case in the Lab tab.
--   * lab_status   — where the kit is in the lab's own flow: received / scan /
--     in_production (NULL = just in transit). "received" and "in_production" also
--     advance the case's pipeline stage so the CX live card updates; "scan" does not.
--
-- Idempotent: safe to run more than once. Run in Supabase SQL Editor.

ALTER TABLE public.cx_cases
  ADD COLUMN IF NOT EXISTS lab_eta_date DATE,
  ADD COLUMN IF NOT EXISTS lab_status   TEXT;

NOTIFY pgrst, 'reload schema';
