-- v96: Agents on call around the clock, and a record of every call you make
-- The agents no longer wait for office hours: research, writing and pulls run
-- whenever there is work, and anything you ask for in the office starts on the
-- spot. Only the automatic email send still respects a sending window, and
-- that is now a setting you can switch off.
-- Needs schema_v95_lead_supply.sql first. Run in Supabase SQL Editor.

-- Automatic sending stays inside 9-5 unless you turn this off. Your own
-- "Send approved now" button ignores it either way.
ALTER TABLE public.ai_outreach_settings ADD COLUMN IF NOT EXISTS send_hours_only BOOLEAN NOT NULL DEFAULT TRUE;

-- ── Your calls ─────────────────────────────────────────────────────────────────
-- One row per call you make, so a lead can be tried more than once and you keep
-- the notes from each attempt.
CREATE TABLE IF NOT EXISTS public.ai_call_notes (
  id          BIGSERIAL   PRIMARY KEY,
  lead_id     UUID        NOT NULL REFERENCES public.ai_leads(id) ON DELETE CASCADE,
  outreach_id UUID        REFERENCES public.ai_outreach(id) ON DELETE SET NULL,
  outcome     TEXT        NOT NULL CHECK (outcome IN ('no_answer','callback','interested','booked','not_interested','left_voicemail')),
  note        TEXT        NOT NULL DEFAULT '',
  called_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_call_notes_lead_idx ON public.ai_call_notes (lead_id, called_at DESC);

ALTER TABLE public.ai_call_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_call_notes_sel" ON public.ai_call_notes FOR SELECT USING (auth.role() = 'authenticated');

-- 'left_voicemail' is a call outcome too.
ALTER TABLE public.ai_outreach DROP CONSTRAINT IF EXISTS ai_outreach_status_check;
ALTER TABLE public.ai_outreach ADD CONSTRAINT ai_outreach_status_check
  CHECK (status IN ('draft','compliance','blocked','scheduled','sent','replied','bounced','skipped','failed',
                    'to_call','no_answer','callback','interested','booked','not_interested','left_voicemail'));

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_call_notes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
