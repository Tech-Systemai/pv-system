-- v75: Multi-step lab tracking for impression kits.
--
-- v74 stored a single `lab_status` string (one state at a time). The Lab tab now
-- needs every step tracked independently — the lab can tick Received, Scan, In
-- Production, Quality check, Sent to U.S. and Received in U.S. in any combination.
-- So we move to an array of completed step keys.
--
--   lab_steps — text[] of the lab steps that are checked. Possible values:
--     'received', 'scan', 'in_production', 'quality_check', 'sent_us', 'received_us'.
--     'received', 'in_production' and 'quality_check' also drive the customer's
--     pipeline stage (those stages are lab-controlled and locked on the CX card);
--     'scan', 'sent_us' and 'received_us' are lab-internal only.
--
-- `lab_status` from v74 is left in place (harmless) but no longer written.
--
-- Idempotent: safe to run more than once. Run in Supabase SQL Editor.

ALTER TABLE public.cx_cases
  ADD COLUMN IF NOT EXISTS lab_steps TEXT[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
