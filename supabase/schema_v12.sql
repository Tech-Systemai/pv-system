-- v12: Approval workflow for inbox documents and schedules

ALTER TABLE inbox_documents ADD COLUMN IF NOT EXISTS approval_status   TEXT DEFAULT 'approved'; -- 'pending' | 'approved' | 'rejected'
ALTER TABLE inbox_documents ADD COLUMN IF NOT EXISTS submitted_by_name TEXT;
ALTER TABLE schedules       ADD COLUMN IF NOT EXISTS submitted_by_name TEXT;
