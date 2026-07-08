-- v87: Planning — live time tracking (clock in / out) per board
-- A board's clock counts UP while running. time_running_since is set to the
-- moment the clock was started (null while paused); time_accrued_seconds is the
-- total banked time from previous runs.
-- Elapsed = time_accrued_seconds + (now - time_running_since) while running.
-- Run in Supabase SQL Editor

ALTER TABLE public.planning_documents
  ADD COLUMN IF NOT EXISTS time_running_since   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS time_accrued_seconds INTEGER NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
