-- v45: Create company_policies table (avoids conflict with existing Policy Engine 'policies' table)

CREATE TABLE IF NOT EXISTS public.company_policies (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title          TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT 'General',
  status         TEXT NOT NULL DEFAULT 'Draft',
  effective_date DATE,
  content        TEXT,
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.company_policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='company_policies' AND policyname='Authenticated users can read company_policies') THEN
    CREATE POLICY "Authenticated users can read company_policies"
      ON public.company_policies FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='company_policies' AND policyname='Management can insert company_policies') THEN
    CREATE POLICY "Management can insert company_policies"
      ON public.company_policies FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin'))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='company_policies' AND policyname='Management can update company_policies') THEN
    CREATE POLICY "Management can update company_policies"
      ON public.company_policies FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin'))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='company_policies' AND policyname='Management can delete company_policies') THEN
    CREATE POLICY "Management can delete company_policies"
      ON public.company_policies FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin'))
      );
  END IF;
END $$;
