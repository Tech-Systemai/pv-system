-- ── schema_v8: inbox + payroll fixes ────────────────────────────────────────
-- Run in Supabase → SQL Editor. Safe to re-run.

-- inbox_documents: missing columns that cause archive/reply/tracking to fail
ALTER TABLE inbox_documents ADD COLUMN IF NOT EXISTS archived   BOOLEAN DEFAULT FALSE;
ALTER TABLE inbox_documents ADD COLUMN IF NOT EXISTS reply_to   BIGINT REFERENCES inbox_documents(id) ON DELETE SET NULL;
ALTER TABLE inbox_documents ADD COLUMN IF NOT EXISTS sender_id  UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- payrolls: adjustment + notes fields for manual overrides
ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS bonuses          NUMERIC DEFAULT 0;
ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS deduction_notes  TEXT;
ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS manual_adj       NUMERIC DEFAULT 0;

-- Done.
