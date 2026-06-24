-- v70: Link CX cases to GoHighLevel CRM contacts
-- Lets the GHL webhook upsert the same case on repeat events (idempotent).
-- Run in Supabase SQL Editor.

ALTER TABLE public.cx_cases
  ADD COLUMN IF NOT EXISTS ghl_contact_id TEXT;

-- Unique so the webhook can upsert on conflict. Partial index ignores NULLs
-- (manually-created cases have no GHL id and must not collide with each other).
CREATE UNIQUE INDEX IF NOT EXISTS cx_cases_ghl_contact_id_key
  ON public.cx_cases (ghl_contact_id)
  WHERE ghl_contact_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
