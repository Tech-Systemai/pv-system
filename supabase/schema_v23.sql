-- v23: Ticket types (employee / customer), CX visibility

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'employee';

-- CX agents can see all customer tickets
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'CX can view customer tickets'
  ) THEN
    CREATE POLICY "CX can view customer tickets" ON public.tickets
      FOR SELECT USING (
        ticket_type = 'customer'
        AND auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'cx')
      );
  END IF;
END $$;
