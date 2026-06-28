-- v78: Completed-stage outcome routing.
--
-- The pipeline now ends at "Completed". In that stage the agent answers whether
-- there are any issues with the veneers. Once the Completed stage is checked
-- (100% done) the profile moves to one of two new CX tabs based on the answer:
--   * completed_outcome = 'issues'  → "Issues" tab
--   * completed_outcome = 'success' → "Completed Success" tab
-- All case history/data stays on the same row, so nothing is lost in the move.
--
-- Idempotent: safe to run more than once. Run in Supabase SQL Editor.

ALTER TABLE public.cx_cases
  ADD COLUMN IF NOT EXISTS completed_outcome TEXT;

NOTIFY pgrst, 'reload schema';
