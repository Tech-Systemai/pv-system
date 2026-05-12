-- v38: Pending status for self-registered users awaiting approval

-- 1. Extend the status enum
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'Pending';

-- 2. Update handle_new_user so self-registered accounts start as Pending
--    (Admin-created accounts are overridden to 'Active' by createEmployeeAccount)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, name, department, status)
  VALUES (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    'Pending',
    'Pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
