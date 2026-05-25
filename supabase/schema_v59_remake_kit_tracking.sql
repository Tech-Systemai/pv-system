-- Add impression kit tracking number to remake_requests
ALTER TABLE public.remake_requests
  ADD COLUMN IF NOT EXISTS impression_kit_tracking TEXT;
