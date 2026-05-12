-- v35: Add completion note and file attachment to tasks

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completion_note      TEXT,
  ADD COLUMN IF NOT EXISTS completion_file_url  TEXT,
  ADD COLUMN IF NOT EXISTS completion_file_name TEXT;
