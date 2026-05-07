-- v9: Fix inbox subject NOT NULL, add attachment columns

-- Drop NOT NULL on subject so old code paths can't break inserts
ALTER TABLE inbox_documents ALTER COLUMN subject DROP NOT NULL;
ALTER TABLE inbox_documents ALTER COLUMN subject SET DEFAULT '';

-- Attachment support
ALTER TABLE inbox_documents ADD COLUMN IF NOT EXISTS attachment_url  TEXT;
ALTER TABLE inbox_documents ADD COLUMN IF NOT EXISTS attachment_name TEXT;
