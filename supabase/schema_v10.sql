-- v10: Contract signatures

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS employer_signature  TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS employer_signed_at  TIMESTAMPTZ;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS employee_signature  TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS employee_signed_at  TIMESTAMPTZ;
