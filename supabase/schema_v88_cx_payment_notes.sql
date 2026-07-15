-- v88: CX live card — add a "Payment notes" multi-entry log alongside
--      customer_notes_log and lab_notes_log.
ALTER TABLE public.cx_cases
  ADD COLUMN IF NOT EXISTS payment_notes_log JSONB NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
