-- v49: KB course/lesson columns + per-user progress tracking
-- Run in Supabase SQL Editor

ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS lesson_type  TEXT    NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS duration     TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS order_index  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_url    TEXT,
  ADD COLUMN IF NOT EXISTS lesson_file  JSONB;

CREATE TABLE IF NOT EXISTS public.kb_progress (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  article_id   BIGINT  NOT NULL REFERENCES public.knowledge_base(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

ALTER TABLE public.kb_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_prog_sel" ON public.kb_progress FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "kb_prog_ins" ON public.kb_progress FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "kb_prog_del" ON public.kb_progress FOR DELETE USING (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';
