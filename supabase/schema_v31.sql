-- v31: Add missing body column to notifications table
--      (table was created before body column was introduced)

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body TEXT;
