-- v46: planning_documents table for shared board persistence
-- Run this in Supabase SQL Editor

-- Drop and recreate cleanly
DROP TABLE IF EXISTS public.planning_documents CASCADE;

CREATE TABLE public.planning_documents (
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

ALTER TABLE public.planning_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pd_select" ON public.planning_documents
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pd_insert" ON public.planning_documents
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "pd_update" ON public.planning_documents
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "pd_delete" ON public.planning_documents
  FOR DELETE USING (auth.role() = 'authenticated');

-- Force PostgREST to reload its schema cache so the new table is immediately usable
NOTIFY pgrst, 'reload schema';
