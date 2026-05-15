-- v43: Create daily_updates table for shift-based check-in prompts

CREATE TABLE IF NOT EXISTS public.daily_updates (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date       DATE NOT NULL,
  prompt     TEXT NOT NULL CHECK (prompt IN ('start', 'midday', 'end')),
  answer     TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (user_id, date, prompt)
);

ALTER TABLE public.daily_updates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_updates' AND policyname='Users can insert own daily updates') THEN
    CREATE POLICY "Users can insert own daily updates"
      ON public.daily_updates FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_updates' AND policyname='Users can view own daily updates') THEN
    CREATE POLICY "Users can view own daily updates"
      ON public.daily_updates FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_updates' AND policyname='Management can view all daily updates') THEN
    CREATE POLICY "Management can view all daily updates"
      ON public.daily_updates FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('owner', 'admin', 'supervisor')
        )
      );
  END IF;
END $$;
