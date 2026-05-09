-- v14: Add missing columns to hr_applicants

ALTER TABLE public.hr_applicants
  ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'Applied',
  ADD COLUMN IF NOT EXISTS notes TEXT;
