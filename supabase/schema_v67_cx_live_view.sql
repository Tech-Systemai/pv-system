-- v67: CX live view — contact details, order details, payment split,
--      per-stage next-step checklist, and multi-entry logs.
ALTER TABLE public.cx_cases
  -- Contact / order header
  ADD COLUMN IF NOT EXISTS order_number        TEXT,
  ADD COLUMN IF NOT EXISTS email               TEXT,
  ADD COLUMN IF NOT EXISTS address             TEXT,
  -- Order details
  ADD COLUMN IF NOT EXISTS veneer_set          TEXT,
  ADD COLUMN IF NOT EXISTS veneer_shade        TEXT,
  ADD COLUMN IF NOT EXISTS shipping            TEXT,
  ADD COLUMN IF NOT EXISTS special_request     TEXT,
  -- Payment split (payment_left stays in sync = full_price - amount_collected)
  ADD COLUMN IF NOT EXISTS full_price          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS amount_collected    NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Next-step guide: { "<stage_key>": [<done step index>, ...] }
  ADD COLUMN IF NOT EXISTS stage_checklist     JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Multi-entry logs: each [{ id, text|label|number|reason, by, date }]
  ADD COLUMN IF NOT EXISTS issues_log          JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_notes_log  JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lab_notes_log       JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tracking_log        JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS remakes_log         JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS referrals           JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- "Push to customer" timestamp
  ADD COLUMN IF NOT EXISTS pushed_to_customer_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
