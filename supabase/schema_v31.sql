-- v31: Reconcile notifications table created by schema_v3 with the newer schema.
--      The original table had `message TEXT NOT NULL` and no body/link_id columns.
--      Triggers from v30 insert body/link_id and omit message, causing NOT NULL failures.

-- Add columns that v26 assumed existed but were skipped by CREATE TABLE IF NOT EXISTS
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body    TEXT,
  ADD COLUMN IF NOT EXISTS link_id UUID;

-- Remove the NOT NULL constraint on the old `message` column so triggers don't have to supply it
ALTER TABLE public.notifications
  ALTER COLUMN message DROP NOT NULL,
  ALTER COLUMN message SET DEFAULT '';
