-- v18: Add signature tracking to reports table

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS employee_signature  TEXT,
  ADD COLUMN IF NOT EXISTS employee_signed_at  TIMESTAMPTZ;
