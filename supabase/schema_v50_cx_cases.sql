-- v50: Customer Service — case tracker + daily update log
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.cx_cases (
  id                  BIGSERIAL PRIMARY KEY,
  customer_name       TEXT NOT NULL,
  phone               TEXT,
  issue               TEXT NOT NULL DEFAULT '',
  action_taken        TEXT,
  customer_words      TEXT,
  lab_notes           TEXT,
  pipeline_stage      TEXT NOT NULL DEFAULT 'IMP KIT SENT',
  status              TEXT NOT NULL DEFAULT 'New CX',
  priority            TEXT NOT NULL DEFAULT 'MEDIUM',
  payment_left        NUMERIC(10,2),
  pay_status          TEXT DEFAULT 'Paid',
  assigned_to         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  on_hold             BOOLEAN NOT NULL DEFAULT FALSE,
  hold_reason         TEXT,
  escalated           BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_note     TEXT,
  escalation_severity TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.cx_updates (
  id          BIGSERIAL PRIMARY KEY,
  case_id     BIGINT NOT NULL REFERENCES public.cx_cases(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  update_date DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_by   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cx_cases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cx_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cx_cases_all"   ON public.cx_cases   FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "cx_updates_all" ON public.cx_updates FOR ALL USING (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';
