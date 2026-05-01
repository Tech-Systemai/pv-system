-- Create Enum Types
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'supervisor', 'accountant', 'sales', 'cx');
CREATE TYPE user_status AS ENUM ('Active', 'Inactive', 'Suspended');

-- Create Profiles Table (Links to Supabase Auth)
CREATE TABLE public.profiles (
  id uuid references auth.users not null primary key,
  username text unique not null,
  name text not null,
  role user_role not null default 'sales',
  department text not null,
  salary numeric default 0,
  points integer default 7,
  score integer default 100,
  status user_status default 'Active',
  location text,
  hired_date date default CURRENT_DATE,
  clocked_in boolean default false,
  current_activity text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Owner/Admin can view all profiles
CREATE POLICY "Owners and Admins can view all profiles" 
  ON public.profiles FOR SELECT 
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'admin'))
  );

-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

-- Owners/Admins can update all profiles
CREATE POLICY "Owners and Admins can update all profiles" 
  ON public.profiles FOR UPDATE 
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'admin'))
  );

-- Tasks Table
CREATE TABLE public.tasks (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  assigned_to uuid references public.profiles(id),
  assigned_by uuid references public.profiles(id),
  due_date timestamp with time zone,
  priority text default 'Medium',
  acknowledged boolean default false,
  completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Users can see tasks assigned to them, or tasks they assigned. Admins see all.
CREATE POLICY "View Tasks" ON public.tasks FOR SELECT USING (
  auth.uid() = assigned_to OR 
  auth.uid() = assigned_by OR 
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'admin', 'supervisor'))
);

-- Policies Table
CREATE TABLE public.policies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  trigger text not null,
  action text not null,
  active boolean default true,
  executed integer default 0
);

-- Insert Initial Mock Policy Data
INSERT INTO public.policies (name, trigger, action, active, executed) VALUES
('Late Clock-In Penalty', 'Every 5 min late', '-0.5 points · -$10 salary', true, 0),
('No-Show Penalty', 'Full day absence', '-3 points · -$60 salary', true, 0),
('Termination Trigger', '7 points lost in cycle', 'Auto-flag for termination review', true, 0);

-- Function to handle new user registration triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, name, department)
  VALUES (new.id, new.email, split_part(new.email, '@', 1), 'Pending');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auth.users creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
