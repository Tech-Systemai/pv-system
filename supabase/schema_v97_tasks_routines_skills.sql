-- v97: The task bar, routines and skills
-- Three things the office was missing: one box you can type any job into,
-- schedules of your own, and process notes that stick to an agent.
-- Needs schema_v96_always_on.sql first. Run in Supabase SQL Editor.

-- ── Skills: how you want the work done ─────────────────────────────────────────
-- A skill is your process in your words. It is added to the agent's brief
-- before every job it runs, so you teach it once.
CREATE TABLE IF NOT EXISTS public.ai_skills (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL,
  -- Who it applies to: one agent (slug), a whole floor (department key), or everyone.
  scope      TEXT        NOT NULL DEFAULT 'agent' CHECK (scope IN ('agent', 'department', 'all')),
  target     TEXT        NOT NULL DEFAULT '',
  body       TEXT        NOT NULL DEFAULT '',
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_skills_target_idx ON public.ai_skills (scope, target) WHERE active;

-- ── Routines: the office's own clock ───────────────────────────────────────────
-- "Pull 40 new leads every weekday at 8am". The heartbeat fires whichever ones
-- are due; each runs at most once a day.
CREATE TABLE IF NOT EXISTS public.ai_routines (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  action      TEXT        NOT NULL CHECK (action IN ('find_leads', 'research', 'write_emails', 'send_emails')),
  params      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- 'daily' or 'weekdays', or a list like 'mon,wed,fri'.
  days        TEXT        NOT NULL DEFAULT 'weekdays',
  at_hour     INTEGER     NOT NULL DEFAULT 8  CHECK (at_hour BETWEEN 0 AND 23),
  at_minute   INTEGER     NOT NULL DEFAULT 0  CHECK (at_minute BETWEEN 0 AND 59),
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  last_result TEXT        NOT NULL DEFAULT '',
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A starting set, switched off until you turn them on.
INSERT INTO public.ai_routines (name, action, params, days, at_hour, active)
SELECT * FROM (VALUES
  ('Top up the lead list',        'find_leads',   '{"max":40}'::jsonb, 'weekdays',  8, FALSE),
  ('Research the new leads',      'research',     '{"limit":12}'::jsonb, 'weekdays',  9, FALSE),
  ('Write the morning emails',    'write_emails', '{"limit":5}'::jsonb,  'weekdays', 10, FALSE),
  ('Send what I approved',        'send_emails',  '{}'::jsonb,           'weekdays', 11, FALSE)
) AS seed(name, action, params, days, at_hour, active)
WHERE NOT EXISTS (SELECT 1 FROM public.ai_routines);

ALTER TABLE public.ai_skills   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_skills_sel"   ON public.ai_skills   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ai_routines_sel" ON public.ai_routines FOR SELECT USING (auth.role() = 'authenticated');

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_routines;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
