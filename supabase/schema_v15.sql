-- v15: Access requests — employees can request module access, owner approves/denies

CREATE TABLE IF NOT EXISTS public.access_requests (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_name      TEXT,
  user_role      TEXT,
  module         TEXT NOT NULL,
  requested_view TEXT NOT NULL DEFAULT 'agent', -- 'agent' | 'admin' | 'both'
  reason         TEXT,
  status         TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'denied'
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read all access requests" ON public.access_requests
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'admin'))
  );

CREATE POLICY "Users manage own requests" ON public.access_requests
  FOR ALL USING (auth.uid() = user_id);
