-- v40: Fix collection_type options, drop location column
-- Run this only if you already ran schema_v39.sql

-- Drop old check constraint (auto-named) and add correct one
ALTER TABLE public.sales_logs
  DROP COLUMN IF EXISTS location;

-- Replace the check constraint on collection_type
-- First drop the column's inline constraint by recreating it
ALTER TABLE public.sales_logs
  DROP COLUMN IF EXISTS collection_type;

ALTER TABLE public.sales_logs
  ADD COLUMN IF NOT EXISTS collection_type TEXT CHECK (collection_type IN ('CRM', 'Website', 'Partially'));
