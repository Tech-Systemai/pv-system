-- v16: Add missing columns to inbox_documents

ALTER TABLE public.inbox_documents
  ADD COLUMN IF NOT EXISTS title     TEXT,
  ADD COLUMN IF NOT EXISTS content   TEXT,
  ADD COLUMN IF NOT EXISTS signed_by TEXT;
