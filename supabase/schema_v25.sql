-- v25: Ticket assignment (claim by agent)

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users;
