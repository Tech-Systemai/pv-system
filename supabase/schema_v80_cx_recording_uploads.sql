-- v80: Impression-appointment recording uploads.
--
-- After the agent finishes the virtual Impression Kit appointment on Sylaps,
-- they upload the meeting recording from the "Pre impression kit appointment"
-- stage. Each upload is stored on the case as one entry in a JSONB array so the
-- full history stays with the customer's card:
--
--   recording_uploads — JSONB array of
--     { id, url, file_name, by (profile id), date }.
--
-- Owners and admins see every uploaded recording — with the customer's name and
-- order/card number — in the new "Recording Uploads" section (Impression Care
-- recordings). The data lives here; that page just reads across all cases.
--
-- Idempotent: safe to run more than once. Run in Supabase SQL Editor.

ALTER TABLE public.cx_cases
  ADD COLUMN IF NOT EXISTS recording_uploads JSONB NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
