-- v55: impression_kits — parent link for remakes + notes field
ALTER TABLE public.impression_kits
  ADD COLUMN IF NOT EXISTS parent_kit_id BIGINT REFERENCES public.impression_kits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;
