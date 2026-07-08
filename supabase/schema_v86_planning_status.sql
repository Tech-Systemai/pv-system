-- v86: Planning — board status + time tracking
-- Each planning board can be In Progress (default), Extended, or Closed.
-- status_changed_at stamps when the status was last set; it is shown on the
-- outer board card so you can see at a glance when a board was closed/extended.
-- Run in Supabase SQL Editor

ALTER TABLE public.planning_documents
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
