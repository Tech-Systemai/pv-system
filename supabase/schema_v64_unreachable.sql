-- v64: Add unreachable flag to cx_cases
-- Cases marked unreachable are moved to their own section and excluded
-- from the update-due counter, similar to no_update_needed.

ALTER TABLE cx_cases
  ADD COLUMN IF NOT EXISTS unreachable BOOLEAN NOT NULL DEFAULT FALSE;
