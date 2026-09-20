-- v94: The office — who is on the floor, and what you say to them
-- The Office tab is a live picture of the agents you brought in: the ones
-- working sit at desks, the rest roam. You can talk to any of them and leave
-- assignments on their desk.
-- Needs schema_v93_outreach_email.sql first. Run in Supabase SQL Editor.

-- Who is on the office floor (as opposed to on the building's floor plan).
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS in_office BOOLEAN NOT NULL DEFAULT FALSE;

-- The agents that actually run today start in the office.
UPDATE public.ai_agents SET in_office = TRUE
WHERE slug IN ('leadgen-maps','research-qualifier','research-callprep','outreach-writer','compliance-email','outreach-sender');

-- ── Conversations ──────────────────────────────────────────────────────────────
-- What you said to an agent and what it said back, newest last.
CREATE TABLE IF NOT EXISTS public.ai_agent_messages (
  id         BIGSERIAL   PRIMARY KEY,
  agent_id   UUID        NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('founder','agent')),
  text       TEXT        NOT NULL DEFAULT '',
  -- Set when a message created an assignment on the agent's desk.
  work_id    UUID        REFERENCES public.ai_agent_work(id) ON DELETE SET NULL,
  said_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_agent_messages_agent_idx ON public.ai_agent_messages (agent_id, created_at);

ALTER TABLE public.ai_agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_agent_messages_sel" ON public.ai_agent_messages FOR SELECT USING (auth.role() = 'authenticated');

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agent_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
