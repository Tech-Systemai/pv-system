-- v73: Sequential order numbering for CRM/GHL/manual cases, starting at 6000.
--
-- Rules:
--   * Shopify orders already arrive with their own order_number (e.g. #1001) —
--     never renumber them.
--   * Every other case (CRM / GHL / manually added) that has no order_number
--     gets the next number from a shared sequence, beginning at 6000.
--   * Seeds the two current un-numbered CRM orders: Samantha Lee (6000) and
--     yolanda Cadlett (6001). Future orders continue 6002, 6003, …
--
-- Idempotent: safe to run more than once. Run in Supabase SQL Editor.

-- 1. The shared counter.
CREATE SEQUENCE IF NOT EXISTS public.cx_order_seq START WITH 6000 INCREMENT BY 1;

-- 2. Auto-assign the next number on insert when none is supplied and the case
--    did not come from Shopify.
CREATE OR REPLACE FUNCTION public.cx_assign_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.order_number IS NULL OR btrim(NEW.order_number) = '')
     AND COALESCE(NEW.source, '') <> 'Shopify' THEN
    NEW.order_number := nextval('public.cx_order_seq')::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cx_assign_order_number_trg ON public.cx_cases;
CREATE TRIGGER cx_assign_order_number_trg
  BEFORE INSERT ON public.cx_cases
  FOR EACH ROW EXECUTE FUNCTION public.cx_assign_order_number();

-- 3. Seed the two existing un-numbered CRM orders, oldest first so Samantha = 6000.
--    The WHERE guard keeps this idempotent (won't renumber if already set).
UPDATE public.cx_cases SET order_number = nextval('public.cx_order_seq')::text
  WHERE id = 98 AND (order_number IS NULL OR btrim(order_number) = '');  -- Samantha Lee  -> 6000
UPDATE public.cx_cases SET order_number = nextval('public.cx_order_seq')::text
  WHERE id = 99 AND (order_number IS NULL OR btrim(order_number) = '');  -- yolanda Cadlett -> 6001

NOTIFY pgrst, 'reload schema';
