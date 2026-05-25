-- v58: Remake requests — post-delivery quality claims CX → owner → production pipeline

CREATE SEQUENCE IF NOT EXISTS remake_requests_id_seq START 2000;

CREATE TABLE IF NOT EXISTS public.remake_requests (
  id                  BIGINT PRIMARY KEY DEFAULT nextval('remake_requests_id_seq'),
  patient_name        TEXT NOT NULL,
  phone               TEXT,
  original_case_id    TEXT,
  delivered_date      DATE,
  reason_category     TEXT NOT NULL DEFAULT 'Other',
  complaint           TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending_review',
  -- status: pending_review | in_production | delivered | rejected

  submitted_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_by_name   TEXT,
  approved_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  rejected_at         TIMESTAMPTZ,
  rejection_reason    TEXT,

  remake_type         TEXT,     -- 'Full remake' | 'Partial remake'
  priority            TEXT,     -- 'Standard (4–6 weeks)' | 'Rush' | 'Urgent'
  estimated_delivery  DATE,
  lab_name            TEXT,
  ship_impression_kit BOOLEAN NOT NULL DEFAULT false,
  owner_notes         TEXT,

  -- Production stage timestamps (NULL = not yet reached)
  stage_case_at     TIMESTAMPTZ,
  stage_kit_at      TIMESTAMPTZ,
  stage_imp_at      TIMESTAMPTZ,
  stage_lab_at      TIMESTAMPTZ,
  stage_qc_at       TIMESTAMPTZ,
  stage_shipped_at  TIMESTAMPTZ,

  activity  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.remake_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  BIGINT NOT NULL REFERENCES public.remake_requests(id) ON DELETE CASCADE,
  photo_type  TEXT NOT NULL DEFAULT 'PHOTO',
  photo_label TEXT,
  photo_url   TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.remake_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remake_photos    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read remake_requests"
  ON public.remake_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth insert remake_requests"
  ON public.remake_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth update remake_requests"
  ON public.remake_requests FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "auth read remake_photos"
  ON public.remake_photos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth insert remake_photos"
  ON public.remake_photos FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- NOTE: photos are stored in the 'employee-docs' Supabase Storage bucket
-- under the path remake/{request_id}/{index}.{ext}
-- Ensure the bucket policy allows authenticated uploads.
