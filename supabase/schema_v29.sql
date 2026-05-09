-- v29: Add messages + inbox_documents to realtime publication
--      REPLICA IDENTITY FULL ensures instant delivery (no polling fallback)

ALTER TABLE public.messages        REPLICA IDENTITY FULL;
ALTER TABLE public.inbox_documents REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='inbox_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_documents;
  END IF;
END $$;
