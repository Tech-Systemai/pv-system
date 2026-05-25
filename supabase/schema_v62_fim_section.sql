-- Add section column to FIM tables to support CS / Lab / Sales views
ALTER TABLE public.fim_fault_codes ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'cx';
ALTER TABLE public.fim_sops        ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'cx';
