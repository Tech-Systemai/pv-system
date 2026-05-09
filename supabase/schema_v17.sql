-- v17: Persistent reports table

CREATE TABLE IF NOT EXISTS public.reports (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  type            TEXT         NOT NULL,
  target_type     TEXT         NOT NULL DEFAULT 'individual',
  employee_id     UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  employee_name   TEXT,
  employee_role   TEXT,
  notes           TEXT,
  session_id      UUID,
  html_content    TEXT,
  created_by      UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at      TIMESTAMPTZ  DEFAULT now()
);
