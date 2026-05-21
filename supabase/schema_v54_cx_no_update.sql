-- v54: Add no_update_needed flag to cx_cases
ALTER TABLE public.cx_cases
  ADD COLUMN IF NOT EXISTS no_update_needed BOOLEAN NOT NULL DEFAULT FALSE;
