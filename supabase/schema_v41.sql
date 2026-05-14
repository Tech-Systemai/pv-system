-- v41: Create notes table (was missing — referenced in v36 but never created)

CREATE TABLE IF NOT EXISTS public.notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT,
  type        TEXT DEFAULT 'General',
  shared_with UUID[] DEFAULT '{}',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add any missing columns in case a partial version exists
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS shared_with UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Users can read their own notes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='Users can view own notes') THEN
    CREATE POLICY "Users can view own notes"
      ON public.notes FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Users can read notes shared with them
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='Users can view shared notes') THEN
    CREATE POLICY "Users can view shared notes"
      ON public.notes FOR SELECT USING (auth.uid() = ANY(shared_with));
  END IF;
END $$;
