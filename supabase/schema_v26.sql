-- v26: In-app notifications (ticket events)

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  type       TEXT DEFAULT 'ticket',   -- 'ticket_new' | 'ticket_reply' | 'ticket_resolved'
  link_id    UUID,                     -- ticket id
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='Users read own notifications') THEN
    CREATE POLICY "Users read own notifications" ON public.notifications
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='Users delete own notifications') THEN
    CREATE POLICY "Users delete own notifications" ON public.notifications
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
