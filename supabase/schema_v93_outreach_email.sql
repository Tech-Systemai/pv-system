-- v93: Outreach email — the connected inbox, the pitch, and sending state
-- Quill writes a one-off email per lead, Shield checks it, the founder approves,
-- and Post sends it from the connected Gmail inbox within warm-up limits and
-- watches the thread for a reply.
-- Needs schema_v92_agent_pipeline.sql first. Run in Supabase SQL Editor.

-- ── What Quill needs to write ──────────────────────────────────────────────────
-- One row (id = 'default'). Edited from the Outreach tab.
CREATE TABLE IF NOT EXISTS public.ai_outreach_settings (
  id              TEXT        PRIMARY KEY DEFAULT 'default',
  sender_name     TEXT        NOT NULL DEFAULT '',
  sender_title    TEXT        NOT NULL DEFAULT '',
  postal_address  TEXT        NOT NULL DEFAULT '',
  offer           TEXT        NOT NULL DEFAULT '',
  proof           TEXT        NOT NULL DEFAULT '',
  call_to_action  TEXT        NOT NULL DEFAULT '',
  -- Ceiling per day; the warm-up ramp keeps the real number lower at first.
  daily_limit     INTEGER     NOT NULL DEFAULT 30,
  -- Off: every email waits for approval. On: approved-quality drafts send by themselves.
  auto_send       BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.ai_outreach_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- ── The connected inbox ────────────────────────────────────────────────────────
-- Holds the Gmail refresh token. RLS is on with NO policies, so only the
-- server (service role) can read it; it is never sent to the browser.
CREATE TABLE IF NOT EXISTS public.ai_mailboxes (
  email          TEXT        PRIMARY KEY,
  refresh_token  TEXT        NOT NULL,
  connected_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Sending state on each email ────────────────────────────────────────────────
ALTER TABLE public.ai_outreach ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
ALTER TABLE public.ai_outreach ADD COLUMN IF NOT EXISTS gmail_thread_id  TEXT;
ALTER TABLE public.ai_outreach ADD COLUMN IF NOT EXISTS from_email       TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ai_outreach ADD COLUMN IF NOT EXISTS personal_hook    TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ai_outreach ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.ai_outreach ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;
ALTER TABLE public.ai_outreach ADD COLUMN IF NOT EXISTS error            TEXT NOT NULL DEFAULT '';

-- 'skipped' = founder chose not to send; 'failed' = Gmail refused it.
ALTER TABLE public.ai_outreach DROP CONSTRAINT IF EXISTS ai_outreach_status_check;
ALTER TABLE public.ai_outreach ADD CONSTRAINT ai_outreach_status_check
  CHECK (status IN ('draft','compliance','blocked','scheduled','sent','replied','bounced','skipped','failed',
                    'to_call','no_answer','callback','interested','booked','not_interested'));

CREATE INDEX IF NOT EXISTS ai_outreach_thread_idx ON public.ai_outreach (gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;

ALTER TABLE public.ai_outreach_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_mailboxes         ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_outreach_settings_sel" ON public.ai_outreach_settings FOR SELECT USING (auth.role() = 'authenticated');
-- (ai_mailboxes: deliberately no policies.)

NOTIFY pgrst, 'reload schema';
