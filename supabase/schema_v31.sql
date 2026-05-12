-- v31: Add all missing columns to notifications table
--      (table was created before body/link_id were introduced)

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body    TEXT,
  ADD COLUMN IF NOT EXISTS link_id UUID;
