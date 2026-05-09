-- v19: Ensure inbox_documents has all required columns (idempotent, safe to re-run)

ALTER TABLE public.inbox_documents
  ADD COLUMN IF NOT EXISTS sender_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reply_to          BIGINT  REFERENCES inbox_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS html_content      TEXT,
  ADD COLUMN IF NOT EXISTS doc_ref_type      TEXT,
  ADD COLUMN IF NOT EXISTS doc_ref_id        TEXT,
  ADD COLUMN IF NOT EXISTS attachment_url    TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name   TEXT,
  ADD COLUMN IF NOT EXISTS approval_status   TEXT    DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS title             TEXT,
  ADD COLUMN IF NOT EXISTS content           TEXT,
  ADD COLUMN IF NOT EXISTS signed_by         TEXT;

-- Prevent NOT NULL failures on older required columns
ALTER TABLE public.inbox_documents ALTER COLUMN subject DROP NOT NULL;
ALTER TABLE public.inbox_documents ALTER COLUMN subject SET DEFAULT '';
ALTER TABLE public.inbox_documents ALTER COLUMN sender  DROP NOT NULL;
ALTER TABLE public.inbox_documents ALTER COLUMN sender  SET DEFAULT 'System';
ALTER TABLE public.inbox_documents ALTER COLUMN type    DROP NOT NULL;
ALTER TABLE public.inbox_documents ALTER COLUMN type    SET DEFAULT 'Notice';

-- Allow service_role inserts (admin client already bypasses RLS, but explicit is safer)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inbox_documents' AND policyname = 'Service role can insert'
  ) THEN
    CREATE POLICY "Service role can insert" ON public.inbox_documents
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;
