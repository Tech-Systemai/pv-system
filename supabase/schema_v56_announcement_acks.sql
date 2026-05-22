-- v56: Announcement acknowledgment tracking

CREATE TABLE IF NOT EXISTS public.announcement_acknowledgments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  announcement_ts TEXT        NOT NULL,
  action          TEXT        NOT NULL DEFAULT 'acknowledged'
                              CHECK (action IN ('acknowledged', 'joined')),
  responded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, announcement_ts)
);

ALTER TABLE public.announcement_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Users can insert their own ack
CREATE POLICY "Users can insert own acks"
  ON public.announcement_acknowledgments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can upgrade their own ack (e.g. acknowledged → joined)
CREATE POLICY "Users can update own acks"
  ON public.announcement_acknowledgments FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can read their own ack (to suppress the popup on reload)
CREATE POLICY "Users can read own acks"
  ON public.announcement_acknowledgments FOR SELECT
  USING (auth.uid() = user_id);

-- Owners/admins can read all acks for the response tracker
CREATE POLICY "Admins can read all acks"
  ON public.announcement_acknowledgments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Real-time so the manager view updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_acknowledgments;
