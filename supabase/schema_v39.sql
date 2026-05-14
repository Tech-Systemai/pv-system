-- v39: Extend sales_logs for CX collection detail fields

ALTER TABLE public.sales_logs
  ALTER COLUMN customer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS customer_name   TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone  TEXT,
  ADD COLUMN IF NOT EXISTS customer_email  TEXT,
  ADD COLUMN IF NOT EXISTS collection_type TEXT CHECK (collection_type IN ('CRM', 'Website', 'Partially')),
  ADD COLUMN IF NOT EXISTS collection_date DATE DEFAULT CURRENT_DATE;

-- Allow CX agents to read their own sales_logs rows (mirrors the existing sales policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sales_logs' AND policyname = 'CX can view their own logs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "CX can view their own logs"
        ON public.sales_logs FOR SELECT
        USING (auth.uid() = user_id)
    $policy$;
  END IF;
END $$;
