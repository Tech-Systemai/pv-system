-- v95: Keeping the pipeline full, and the email's look
-- Lead Generation now tops itself up: when the number of qualified leads you
-- have not contacted yet drops below the target, Scout pulls another city.
-- Needs schema_v94_office.sql first. Run in Supabase SQL Editor.

-- How many ready-to-work leads to keep ahead of you, and where to look.
ALTER TABLE public.ai_outreach_settings ADD COLUMN IF NOT EXISTS lead_target  INTEGER NOT NULL DEFAULT 40;
ALTER TABLE public.ai_outreach_settings ADD COLUMN IF NOT EXISTS pull_cities  TEXT    NOT NULL DEFAULT 'Tampa, FL; St Petersburg, FL; Clearwater, FL; Brandon, FL; Lakeland, FL; Sarasota, FL';
-- Shown under the signature of every email, next to the logo.
ALTER TABLE public.ai_outreach_settings ADD COLUMN IF NOT EXISTS logo_url     TEXT    NOT NULL DEFAULT '';
ALTER TABLE public.ai_outreach_settings ADD COLUMN IF NOT EXISTS home_base    TEXT    NOT NULL DEFAULT 'Tampa';

-- Sensible starting values so nothing sits empty waiting on typing.
UPDATE public.ai_outreach_settings SET
  sender_name    = COALESCE(NULLIF(sender_name, ''),   'Olivia'),
  sender_title   = COALESCE(NULLIF(sender_title, ''),  'Founder'),
  offer          = COALESCE(NULLIF(offer, ''),         'Octopus Engines answers every call 24/7 in your business''s name, books the job straight into your calendar, and texts back any call that still gets missed. Set up in a day, month to month.'),
  call_to_action = COALESCE(NULLIF(call_to_action, ''),'a yes to a short video call to see it answering their own line')
WHERE id = 'default';

NOTIFY pgrst, 'reload schema';
