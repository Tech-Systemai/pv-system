-- v85: AI Interviewer — "needs discovery" scoring dimension
-- Did the rep ask questions to understand the customer (why they want veneers,
-- what they're trying to fix, what prompted them to buy)? Scored 0-100 like the
-- other dimensions and weighed heavily in the overall score.
-- Run in Supabase SQL Editor

ALTER TABLE public.interview_scorecards
  ADD COLUMN IF NOT EXISTS discovery INTEGER NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
