-- v20: Add management signature columns to reports

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS management_signature TEXT,
  ADD COLUMN IF NOT EXISTS management_signed_at TIMESTAMPTZ;
