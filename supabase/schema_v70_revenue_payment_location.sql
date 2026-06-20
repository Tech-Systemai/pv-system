-- v70: Revenue tracker — add payment location, retire customer_id from the sale form
-- customer_email already exists (added in v39); customer_id is already nullable (v39).

ALTER TABLE public.sales_logs
  ADD COLUMN IF NOT EXISTS payment_location TEXT;
