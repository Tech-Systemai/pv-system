-- v84: AI Interviewer — timed mock calls + camera/mic recordings
-- call_started_at anchors the server-enforced time limit (starts when the candidate
-- clicks "Start Mock Call", not while reading training). recording_path points at the
-- webm file in the private 'interview-recordings' storage bucket.
-- Run in Supabase SQL Editor

ALTER TABLE public.interview_sessions
  ADD COLUMN IF NOT EXISTS call_started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER NOT NULL DEFAULT 600,
  ADD COLUMN IF NOT EXISTS recording_path     TEXT;

ALTER TABLE public.interview_sessions DROP CONSTRAINT IF EXISTS interview_sessions_ended_reason_check;
ALTER TABLE public.interview_sessions ADD CONSTRAINT interview_sessions_ended_reason_check
  CHECK (ended_reason IN ('candidate_ended','turn_cap','model_ended','time_up'));

NOTIFY pgrst, 'reload schema';
