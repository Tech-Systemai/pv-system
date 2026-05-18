-- v48: Add attachments column to notes table
-- Run in Supabase SQL Editor

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';
