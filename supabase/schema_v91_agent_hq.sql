-- v91: Agent HQ — the org chart, work queue and live feed behind the octopus
-- Turns the flat v89 agent registry into a company: a CEO (the octopus brain),
-- executives (the head), and departments (the arms), each with a manager and
-- specialist agents. Work items carry the founder's requests through to review
-- and revision; events are the running feed the HQ view pops up.
-- The default org is staffed from the portal ("Staff the building"), not here.
-- Run in Supabase SQL Editor

-- ── Departments (the arms) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_departments (
  key        TEXT        PRIMARY KEY,
  name       TEXT        NOT NULL,
  blurb      TEXT        NOT NULL DEFAULT '',
  -- Left-to-right position of the arm around the octopus.
  arm_order  INTEGER     NOT NULL DEFAULT 0,
  -- Accent hue (0-360) the arm's desks are tinted with.
  hue        INTEGER     NOT NULL DEFAULT 268,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Hierarchy and live state on each agent ─────────────────────────────────────
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS slug           TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS title          TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tier           TEXT NOT NULL DEFAULT 'specialist';
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS department     TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS reports_to     UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL;
-- What the agent is doing right now. Written by the agent runtime.
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS activity       TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS current_task   TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS sort_order     INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_tier_chk
    CHECK (tier IN ('ceo','exec','manager','specialist'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_activity_chk
    CHECK (activity IN ('working','idle','reviewing','revising','blocked'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ai_agents_slug_idx ON public.ai_agents (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_agents_dept_idx ON public.ai_agents (department);

-- ── Work items ─────────────────────────────────────────────────────────────────
-- One piece of work an agent owns: a founder request, or a sub-task an agent
-- delegated (parent_id). Revisions stay on the same row so the count is honest.
CREATE TABLE IF NOT EXISTS public.ai_agent_work (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id        UUID        NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  parent_id       UUID        REFERENCES public.ai_agent_work(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  brief           TEXT        NOT NULL DEFAULT '',
  output          TEXT        NOT NULL DEFAULT '',
  status          TEXT        NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','in_progress','in_review','revision','done','cancelled')),
  revision_count  INTEGER     NOT NULL DEFAULT 0,
  revision_notes  TEXT        NOT NULL DEFAULT '',
  requested_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_agent_work_agent_idx  ON public.ai_agent_work (agent_id, status);
CREATE INDEX IF NOT EXISTS ai_agent_work_status_idx ON public.ai_agent_work (status, updated_at DESC);

-- ── Events (the live feed) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_agent_events (
  id          BIGSERIAL   PRIMARY KEY,
  agent_id    UUID        REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  -- The other side of a handoff: who the work went to, or who reviewed it.
  to_agent_id UUID        REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  work_id     UUID        REFERENCES public.ai_agent_work(id) ON DELETE SET NULL,
  kind        TEXT        NOT NULL DEFAULT 'progress'
              CHECK (kind IN ('request','directive','handoff','progress','review','revision','done','alert')),
  message     TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_agent_events_created_idx ON public.ai_agent_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_agent_events_agent_idx   ON public.ai_agent_events (agent_id, created_at DESC);

ALTER TABLE public.ai_departments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_work   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_events ENABLE ROW LEVEL SECURITY;

-- Staff can read (the HQ view subscribes to realtime as the signed-in user).
-- Portal writes go through /api/db with the service role; the agent runtime
-- writes with the service role too.
CREATE POLICY "ai_depts_sel"  ON public.ai_departments  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ai_work_sel"   ON public.ai_agent_work   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ai_events_sel" ON public.ai_agent_events FOR SELECT USING (auth.role() = 'authenticated');

-- Realtime: the HQ view animates agent state, work and events as they land.
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agents;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agent_work;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agent_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
