-- v21: Backfill contract status for already-signed contracts

-- Any contract with both signatures set should be 'Signed'
UPDATE public.contracts
SET status = 'Signed'
WHERE employer_signature IS NOT NULL
  AND employer_signature <> ''
  AND employee_signature IS NOT NULL
  AND employee_signature <> ''
  AND status <> 'Signed';

-- Any contract with only employer signature should be 'Employer Signed'
UPDATE public.contracts
SET status = 'Employer Signed'
WHERE employer_signature IS NOT NULL
  AND employer_signature <> ''
  AND (employee_signature IS NULL OR employee_signature = '')
  AND status = 'Pending';
