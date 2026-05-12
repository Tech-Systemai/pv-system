-- v37: CX collection targets + global settings for cx bonus structure

-- Add collection amount target to targets table
ALTER TABLE public.targets
  ADD COLUMN IF NOT EXISTS collection_amount_target NUMERIC DEFAULT 0;

-- Global settings table for system-wide configuration
CREATE TABLE IF NOT EXISTS public.global_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global settings"
  ON public.global_settings FOR SELECT USING (true);

CREATE POLICY "Owners and admins can modify global settings"
  ON public.global_settings FOR ALL
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'admin')));

-- Seed default CX bonus structure: $3 per $600 collected
INSERT INTO public.global_settings (key, value)
  VALUES ('cx_bonus', '{"amount": 3, "threshold": 600}')
  ON CONFLICT (key) DO NOTHING;
