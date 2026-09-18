-- v92: Agent pipeline — niches, leads and outreach behind the Octopus Engines HQ
-- Lead Generation fills ai_leads from Google Maps; Research scores each lead's
-- willingness to pay and decides how to reach it (call or email); Outreach
-- drafts, compliance-checks and sends, or puts the lead on the founder's call
-- list. ai_niches holds the per-niche settings: channel, GHL page, template.
-- Needs schema_v91_agent_hq.sql first. Run in Supabase SQL Editor.

-- ai_departments.arm_order is now the floor order, 0 = top floor.

-- ── Niches ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_niches (
  key               TEXT        PRIMARY KEY,
  name              TEXT        NOT NULL,
  active            BOOLEAN     NOT NULL DEFAULT TRUE,
  -- 'auto' lets Research identify the channel; 'call' / 'email' locks it.
  channel_mode      TEXT        NOT NULL DEFAULT 'auto' CHECK (channel_mode IN ('auto','call','email')),
  ghl_url           TEXT        NOT NULL DEFAULT '',
  cities            TEXT        NOT NULL DEFAULT '',
  template_subject  TEXT        NOT NULL DEFAULT '',
  template_body     TEXT        NOT NULL DEFAULT '',
  -- Outreach only auto-sends email for a niche once its template is approved.
  template_approved BOOLEAN     NOT NULL DEFAULT FALSE,
  approved_at       TIMESTAMPTZ,
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Leads ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_leads (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  niche              TEXT        NOT NULL REFERENCES public.ai_niches(key) ON UPDATE CASCADE,
  business_name      TEXT        NOT NULL,
  owner_name         TEXT        NOT NULL DEFAULT '',
  city               TEXT        NOT NULL DEFAULT '',
  state              TEXT        NOT NULL DEFAULT '',
  phone              TEXT        NOT NULL DEFAULT '',
  email              TEXT        NOT NULL DEFAULT '',
  website            TEXT        NOT NULL DEFAULT '',
  rating             NUMERIC,
  review_count       INTEGER     NOT NULL DEFAULT 0,
  source             TEXT        NOT NULL DEFAULT 'google_maps',
  -- Raw facts the researcher found (ads, staff size, 24/7, email type…).
  signals            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status             TEXT        NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new','researching','qualified','disqualified','contacted','replied','booked','not_interested')),
  wtp_score          INTEGER,
  wtp_reasons        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  contact_channel    TEXT        CHECK (contact_channel IN ('call','email')),
  channel_confidence INTEGER,
  channel_reasons    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  talking_points     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  researched_by      UUID        REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  researched_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_leads_niche_idx  ON public.ai_leads (niche, status);
CREATE INDEX IF NOT EXISTS ai_leads_status_idx ON public.ai_leads (status, updated_at DESC);
-- One row per business per niche, so re-scraping a city does not duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS ai_leads_dedupe_idx ON public.ai_leads (niche, lower(business_name), phone);

-- ── Outreach ───────────────────────────────────────────────────────────────────
-- An email (draft → compliance → scheduled → sent → replied) or a call-list
-- entry for the founder (to_call → outcome).
CREATE TABLE IF NOT EXISTS public.ai_outreach (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id           UUID        NOT NULL REFERENCES public.ai_leads(id) ON DELETE CASCADE,
  channel           TEXT        NOT NULL CHECK (channel IN ('call','email')),
  status            TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','compliance','blocked','scheduled','sent','replied','bounced',
                                      'to_call','no_answer','callback','interested','booked','not_interested')),
  subject           TEXT        NOT NULL DEFAULT '',
  body              TEXT        NOT NULL DEFAULT '',
  compliance_issues JSONB       NOT NULL DEFAULT '[]'::jsonb,
  notes             TEXT        NOT NULL DEFAULT '',
  agent_id          UUID        REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  sent_at           TIMESTAMPTZ,
  replied_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_outreach_lead_idx   ON public.ai_outreach (lead_id);
CREATE INDEX IF NOT EXISTS ai_outreach_status_idx ON public.ai_outreach (channel, status, updated_at DESC);

ALTER TABLE public.ai_niches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_leads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_outreach ENABLE ROW LEVEL SECURITY;

-- Staff read; writes go through /api/db (service role) and the agent runtime.
CREATE POLICY "ai_niches_sel"   ON public.ai_niches   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ai_leads_sel"    ON public.ai_leads    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ai_outreach_sel" ON public.ai_outreach FOR SELECT USING (auth.role() = 'authenticated');

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_leads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_outreach;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
