-- v67: personal_file_entries — confidential per-employee commendation and incident log
CREATE TABLE IF NOT EXISTS public.personal_file_entries (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('commendation', 'incident')),
  date        date        NOT NULL,
  weight      integer     NOT NULL,
  headline    text        NOT NULL,
  body        text        NOT NULL DEFAULT '',
  logged_by   uuid        REFERENCES public.profiles(id),
  screenshots jsonb       NOT NULL DEFAULT '[]',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.personal_file_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_admins_full_access"
  ON public.personal_file_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
