-- v13: Create permissions table for role-module access matrix

CREATE TABLE IF NOT EXISTS public.permissions (
  id         TEXT PRIMARY KEY,
  matrix     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed a default row so the first read returns data
INSERT INTO public.permissions (id, matrix) VALUES ('main', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
