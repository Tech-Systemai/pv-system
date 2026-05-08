-- v11: Embedded document content in inbox

ALTER TABLE inbox_documents ADD COLUMN IF NOT EXISTS html_content  TEXT;
ALTER TABLE inbox_documents ADD COLUMN IF NOT EXISTS doc_ref_type  TEXT; -- 'contract' | 'payslip' | 'report'
ALTER TABLE inbox_documents ADD COLUMN IF NOT EXISTS doc_ref_id    TEXT; -- source record ID
