-- v22: Inbox folders

CREATE TABLE IF NOT EXISTS public.inbox_folders (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.inbox_folders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inbox_folders' AND policyname = 'Users manage own folders'
  ) THEN
    CREATE POLICY "Users manage own folders" ON public.inbox_folders
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE public.inbox_documents
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES inbox_folders(id) ON DELETE SET NULL;
