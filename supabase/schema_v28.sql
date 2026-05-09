-- v28: REPLICA IDENTITY FULL on realtime tables so postgres_changes filters work

ALTER TABLE public.notifications   REPLICA IDENTITY FULL;
ALTER TABLE public.tickets         REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_replies  REPLICA IDENTITY FULL;
