-- v36: Note sharing — shared_with stores an array of profile UUIDs who can view the note

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS shared_with UUID[] DEFAULT '{}';
