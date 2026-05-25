CREATE SEQUENCE IF NOT EXISTS condition_approvals_id_seq START 1000;

CREATE TABLE IF NOT EXISTS public.condition_approvals (
  id                BIGINT PRIMARY KEY DEFAULT nextval('condition_approvals_id_seq'),
  patient_name      TEXT NOT NULL,
  phone             TEXT,
  veneer_set        TEXT NOT NULL DEFAULT 'Full set',
  veneer_shade      TEXT NOT NULL DEFAULT 'Natural white',
  notes             TEXT,
  lead_source       TEXT,
  status            TEXT NOT NULL DEFAULT 'need_photos',
  -- status: need_photos | awaiting_clearance | retake | cleared | not_a_candidate
  photos            JSONB NOT NULL DEFAULT '{}',
  -- { front: { url, by, byId, at }, left_side: {...}, right_side: {...} }
  submitted_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_by_name TEXT,
  cleared_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cleared_at        TIMESTAMPTZ,
  declined_at       TIMESTAMPTZ,
  decline_reason    TEXT,
  retake_reason     TEXT,
  retake_at         TIMESTAMPTZ,
  activity          JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.condition_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read condition_approvals"
  ON public.condition_approvals FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth insert condition_approvals"
  ON public.condition_approvals FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth update condition_approvals"
  ON public.condition_approvals FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth delete condition_approvals"
  ON public.condition_approvals FOR DELETE USING (auth.role() = 'authenticated');
