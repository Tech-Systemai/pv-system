-- v72: Ingest Shopify orders as CX cases
-- The orders/create webhook (src/app/api/webhooks/shopify) inserts a case per
-- new Shopify order, stamped source='Shopify'. `source` lets the portal badge
-- where a case came from; shopify_order_id makes the webhook idempotent
-- (Shopify retries delivery) and dedupes repeat events to the same order.
-- Run in Supabase SQL Editor.

ALTER TABLE public.cx_cases
  ADD COLUMN IF NOT EXISTS source            TEXT,
  ADD COLUMN IF NOT EXISTS shopify_order_id  TEXT;

-- Unique so the webhook can skip/no-op on repeat deliveries. Partial index
-- ignores NULLs (GHL and manual cases have no Shopify id and must not collide).
CREATE UNIQUE INDEX IF NOT EXISTS cx_cases_shopify_order_id_key
  ON public.cx_cases (shopify_order_id)
  WHERE shopify_order_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
