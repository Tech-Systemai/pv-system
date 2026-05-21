-- v53: Impression Kit — patient photo tracking with owner review workflow
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.impression_kits (
  id             BIGSERIAL PRIMARY KEY,
  patient_name   TEXT NOT NULL,
  phone          TEXT,
  kit_stage      TEXT NOT NULL DEFAULT 'IMP KIT SENT',
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per photo upload (versioned: each re-upload increments version)
CREATE TABLE IF NOT EXISTS public.impression_kit_photos (
  id           BIGSERIAL PRIMARY KEY,
  kit_id       BIGINT NOT NULL REFERENCES public.impression_kits(id) ON DELETE CASCADE,
  photo_type   TEXT NOT NULL,       -- upper_imp | lower_imp | front | left_side | right_side | gum_line
  photo_url    TEXT,
  version      INT NOT NULL DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'awaiting_review',  -- awaiting_review | approved | declined
  reviewed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  feedback     TEXT,
  uploaded_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.impression_kits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impression_kit_photos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'imp_kits_all' AND tablename = 'impression_kits') THEN
    CREATE POLICY "imp_kits_all"   ON public.impression_kits       FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'imp_photos_all' AND tablename = 'impression_kit_photos') THEN
    CREATE POLICY "imp_photos_all" ON public.impression_kit_photos FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
