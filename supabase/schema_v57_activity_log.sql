-- v57: Activity log — complete system audit trail

CREATE TABLE IF NOT EXISTS public.activity_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name   TEXT        NOT NULL DEFAULT 'System',
  module      TEXT        NOT NULL DEFAULT 'system',
  action      TEXT        NOT NULL,
  description TEXT        NOT NULL,
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can view activity log"
  ON public.activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'supervisor')
    )
  );

CREATE POLICY "Anyone can insert activity"
  ON public.activity_log FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_activity_log_created
  ON public.activity_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_module
  ON public.activity_log (module, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
