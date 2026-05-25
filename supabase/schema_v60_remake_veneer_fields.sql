-- Add veneer set and shade to remake_requests
ALTER TABLE public.remake_requests
  ADD COLUMN IF NOT EXISTS veneer_set   TEXT,
  ADD COLUMN IF NOT EXISTS veneer_shade TEXT;
