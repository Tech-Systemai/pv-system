-- v24: Ticket replies (back-and-forth thread)

CREATE TABLE IF NOT EXISTS public.ticket_replies (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id   UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES auth.users NOT NULL,
  sender_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ticket_replies' AND policyname='View replies on own tickets') THEN
    CREATE POLICY "View replies on own tickets" ON public.ticket_replies
      FOR SELECT USING (
        ticket_id IN (SELECT id FROM public.tickets WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ticket_replies' AND policyname='Mgmt view all replies') THEN
    CREATE POLICY "Mgmt view all replies" ON public.ticket_replies
      FOR SELECT USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner','admin','supervisor','cx'))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ticket_replies' AND policyname='Anyone insert replies') THEN
    CREATE POLICY "Anyone insert replies" ON public.ticket_replies
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
