-- v46: Create planning_documents table for shared board persistence

CREATE TABLE IF NOT EXISTS public.planning_documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  board_desc  TEXT NOT NULL DEFAULT '',
  area_id     TEXT NOT NULL DEFAULT 'marketing',
  shared      BOOLEAN NOT NULL DEFAULT false,
  start_date  DATE,
  due_date    DATE,
  content     JSONB NOT NULL DEFAULT '{"widgets":[],"strokes":[]}',
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ensure all columns exist in case the table was created by an earlier partial run
ALTER TABLE public.planning_documents ADD COLUMN IF NOT EXISTS board_desc  TEXT NOT NULL DEFAULT '';
ALTER TABLE public.planning_documents ADD COLUMN IF NOT EXISTS area_id     TEXT NOT NULL DEFAULT 'marketing';
ALTER TABLE public.planning_documents ADD COLUMN IF NOT EXISTS shared      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.planning_documents ADD COLUMN IF NOT EXISTS start_date  DATE;
ALTER TABLE public.planning_documents ADD COLUMN IF NOT EXISTS due_date    DATE;
ALTER TABLE public.planning_documents ADD COLUMN IF NOT EXISTS content     JSONB NOT NULL DEFAULT '{"widgets":[],"strokes":[]}';
ALTER TABLE public.planning_documents ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.planning_documents ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

ALTER TABLE public.planning_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_select" ON public.planning_documents;
CREATE POLICY "pd_select"
  ON public.planning_documents FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "pd_insert" ON public.planning_documents;
CREATE POLICY "pd_insert"
  ON public.planning_documents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "pd_update" ON public.planning_documents;
CREATE POLICY "pd_update"
  ON public.planning_documents FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Delete: only the creator or an owner/admin can delete
DROP POLICY IF EXISTS "pd_delete" ON public.planning_documents;
CREATE POLICY "pd_delete"
  ON public.planning_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.id = planning_documents.created_by
          OR profiles.role IN ('owner', 'admin')
        )
    )
  );
