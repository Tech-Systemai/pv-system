-- v89: AI Agents — registry of outreach/booking agents and their run log
-- Backs the "AI Agents" section of the portal. An agent is a configured worker
-- (prompt + channel + model) that runs outreach or support conversations; a run
-- is one execution of that agent against one contact.
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.ai_agents (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT        NOT NULL,
  purpose       TEXT        NOT NULL DEFAULT '',
  channel       TEXT        NOT NULL DEFAULT 'voice'  CHECK (channel IN ('voice','sms','email','chat','other')),
  status        TEXT        NOT NULL DEFAULT 'draft'  CHECK (status IN ('draft','active','paused','archived')),
  model         TEXT        NOT NULL DEFAULT '',
  system_prompt TEXT        NOT NULL DEFAULT '',
  -- Free-form knobs (voice id, temperature, working hours, webhook URL…) so the
  -- shape can evolve without a migration per setting.
  config        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_agents_status_idx ON public.ai_agents (status);

CREATE TABLE IF NOT EXISTS public.ai_agent_runs (
  id           BIGSERIAL   PRIMARY KEY,
  agent_id     UUID        NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','no_answer')),
  outcome      TEXT        NOT NULL DEFAULT '',
  contact_name TEXT        NOT NULL DEFAULT '',
  contact_info TEXT        NOT NULL DEFAULT '',
  duration_sec INTEGER     NOT NULL DEFAULT 0,
  transcript   TEXT        NOT NULL DEFAULT '',
  error        TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_agent_runs_agent_idx   ON public.ai_agent_runs (agent_id);
CREATE INDEX IF NOT EXISTS ai_agent_runs_created_idx ON public.ai_agent_runs (created_at DESC);

ALTER TABLE public.ai_agents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;

-- Portal staff (authenticated) manage agents and read runs. Writes from the
-- portal go through /api/db, which uses the service role and bypasses RLS.
CREATE POLICY "ai_agents_sel" ON public.ai_agents FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ai_agents_ins" ON public.ai_agents FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ai_agents_upd" ON public.ai_agents FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "ai_agents_del" ON public.ai_agents FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "ai_runs_sel" ON public.ai_agent_runs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ai_runs_ins" ON public.ai_agent_runs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';
