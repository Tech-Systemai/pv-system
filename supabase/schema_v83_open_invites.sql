-- v83: AI Interviewer — open (generic/multi-use) invite links
-- An open invite is a shareable campaign link; each candidate who registers on it
-- gets an auto-created child invite (parent_id) with their own session.
-- Run in Supabase SQL Editor

ALTER TABLE public.interview_invites
  ADD COLUMN IF NOT EXISTS is_open   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.interview_invites(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS interview_invites_parent_idx ON public.interview_invites (parent_id);

NOTIFY pgrst, 'reload schema';
