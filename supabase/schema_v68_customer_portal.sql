-- v68: Customer-facing portal snapshot (myprofile.pioneersveneers.com)
-- One row per case, written when an agent hits "Push to customer".
-- Holds ONLY the fields the customer is allowed to see — never the internal case.
-- Looked up by phone (digits only). RLS is enabled with NO public policy:
-- all reads/writes go through the service-role key on the server, so the table
-- is never directly reachable by anon or authenticated clients.
CREATE TABLE IF NOT EXISTS public.customer_portal (
  case_id           BIGINT PRIMARY KEY REFERENCES public.cx_cases(id) ON DELETE CASCADE,
  phone             TEXT NOT NULL,                 -- digits only, used for lookup
  customer_name     TEXT,
  order_number      TEXT,
  status            TEXT,
  stage_label       TEXT,
  stage_pct         INT,
  next_step_summary TEXT,
  next_steps        JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ text, done }]
  tracking          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ label, number }]
  full_price        NUMERIC(10,2),
  amount_collected  NUMERIC(10,2),
  balance           NUMERIC(10,2),
  published_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_portal_phone_idx ON public.customer_portal (phone);

ALTER TABLE public.customer_portal ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service-role key (server-side) may touch this.

NOTIFY pgrst, 'reload schema';
