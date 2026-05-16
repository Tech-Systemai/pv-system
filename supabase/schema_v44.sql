-- v44: Company Policies module

CREATE TABLE IF NOT EXISTS public.policies (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title          TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT 'General',
  status         TEXT NOT NULL DEFAULT 'Draft',  -- Draft, Active, Archived
  effective_date DATE,
  content        TEXT,   -- JSON array of {title, content} clauses
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='policies' AND policyname='Authenticated users can read policies') THEN
    CREATE POLICY "Authenticated users can read policies"
      ON public.policies FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='policies' AND policyname='Management can insert policies') THEN
    CREATE POLICY "Management can insert policies"
      ON public.policies FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin'))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='policies' AND policyname='Management can update policies') THEN
    CREATE POLICY "Management can update policies"
      ON public.policies FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin'))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='policies' AND policyname='Management can delete policies') THEN
    CREATE POLICY "Management can delete policies"
      ON public.policies FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin'))
      );
  END IF;
END $$;
