-- v82: AI Interviewer — training modules, candidate invites, mock-call sessions, scorecards
-- Used by the standalone candidate site (pv-interviewer, service role) and the portal HR tab.
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.interview_modules (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL DEFAULT '',
  order_index INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.interview_invites (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  token           TEXT        NOT NULL UNIQUE,
  candidate_name  TEXT        NOT NULL DEFAULT '',
  candidate_email TEXT        NOT NULL DEFAULT '',
  applicant_id    UUID        REFERENCES public.hr_applicants(id) ON DELETE SET NULL,
  difficulty      TEXT        NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','expired','revoked')),
  expires_at      TIMESTAMPTZ,
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interview_invites_token_idx ON public.interview_invites (token);

CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  invite_id    UUID        NOT NULL UNIQUE REFERENCES public.interview_invites(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','graded','error')),
  turn_count   INTEGER     NOT NULL DEFAULT 0,
  max_turns    INTEGER     NOT NULL DEFAULT 14,
  ended_reason TEXT        CHECK (ended_reason IN ('candidate_ended','turn_cap','model_ended')),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.interview_messages (
  id         BIGSERIAL   PRIMARY KEY,
  session_id UUID        NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('candidate','customer')),
  content    TEXT        NOT NULL,
  turn_index INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interview_messages_session_idx ON public.interview_messages (session_id, id);

CREATE TABLE IF NOT EXISTS public.interview_scorecards (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id         UUID        NOT NULL UNIQUE REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  overall            INTEGER    NOT NULL DEFAULT 0,
  product_knowledge  INTEGER    NOT NULL DEFAULT 0,
  objection_handling INTEGER    NOT NULL DEFAULT 0,
  rapport            INTEGER    NOT NULL DEFAULT 0,
  closing            INTEGER    NOT NULL DEFAULT 0,
  verdict            TEXT       NOT NULL DEFAULT 'borderline' CHECK (verdict IN ('strong_hire','hire','borderline','no_hire')),
  strengths          JSONB      NOT NULL DEFAULT '[]'::jsonb,
  weaknesses         JSONB      NOT NULL DEFAULT '[]'::jsonb,
  summary            TEXT       NOT NULL DEFAULT '',
  raw                JSONB,
  model              TEXT       NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.interview_modules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_invites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scorecards ENABLE ROW LEVEL SECURITY;

-- Portal staff (authenticated) manage content and read results; the candidate site
-- uses the service role key (bypasses RLS) after validating the invite token.
CREATE POLICY "int_mod_sel" ON public.interview_modules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "int_mod_ins" ON public.interview_modules FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "int_mod_upd" ON public.interview_modules FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "int_mod_del" ON public.interview_modules FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "int_inv_sel" ON public.interview_invites FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "int_inv_ins" ON public.interview_invites FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "int_inv_upd" ON public.interview_invites FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "int_inv_del" ON public.interview_invites FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "int_ses_sel" ON public.interview_sessions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "int_msg_sel" ON public.interview_messages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "int_sc_sel"  ON public.interview_scorecards FOR SELECT USING (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';
