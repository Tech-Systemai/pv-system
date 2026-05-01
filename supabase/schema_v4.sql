-- v4 Schema Additions (Phase 5 Rollout)

-- 1. Attendance Logs
CREATE TABLE public.attendance_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  date date not null default CURRENT_DATE,
  clock_in_time timestamp with time zone,
  clock_out_time timestamp with time zone,
  status text not null, -- 'present', 'late', 'absent'
  productive_time_minutes integer default 0, -- Apploye tracking
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own attendance" ON public.attendance_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Mgmt can view all attendance" ON public.attendance_logs FOR SELECT USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'admin', 'supervisor', 'accountant'))
);
CREATE POLICY "Anyone can insert attendance" ON public.attendance_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can update own attendance" ON public.attendance_logs FOR UPDATE USING (auth.uid() = user_id);

-- 2. Payrolls
CREATE TABLE public.payrolls (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  period text not null, -- e.g. "April 2026"
  base_salary numeric not null default 0,
  deductions numeric not null default 0,
  bonuses numeric not null default 0,
  net_pay numeric not null default 0,
  status text default 'Draft', -- 'Draft', 'Approved', 'Paid'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payroll" ON public.payrolls FOR SELECT USING (auth.uid() = user_id AND status != 'Draft');
CREATE POLICY "Accountants and Owners can manage payroll" ON public.payrolls FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'accountant'))
);

-- 3. Schedules
CREATE TABLE public.schedules (
  id uuid default gen_random_uuid() primary key,
  team text not null,
  week text not null,
  status text default 'Pending', -- 'Pending', 'Approved', 'Rejected'
  created_by uuid references auth.users not null,
  affects_count integer default 0,
  shifts jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view approved schedules" ON public.schedules FOR SELECT USING (status = 'Approved');
CREATE POLICY "Mgmt can view all schedules" ON public.schedules FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'admin', 'supervisor'))
);

-- 4. HR Applicants
CREATE TABLE public.hr_applicants (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  position text not null,
  score integer default 0,
  status text default 'Reviewing', -- 'Reviewing', 'Hired', 'Rejected'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.hr_applicants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mgmt can manage applicants" ON public.hr_applicants FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'admin'))
);

-- 5. Tickets
CREATE TABLE public.tickets (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  user_id uuid references auth.users not null,
  priority text default 'Medium',
  status text default 'Open',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tickets" ON public.tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Mgmt views all tickets" ON public.tickets FOR SELECT USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'admin', 'supervisor'))
);
CREATE POLICY "Anyone can insert" ON public.tickets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Coaching Sessions
CREATE TABLE public.coaching_sessions (
  id uuid default gen_random_uuid() primary key,
  agent_id uuid references auth.users not null,
  supervisor_id uuid references auth.users not null,
  type text not null,
  notes text,
  action_plan text,
  next_review date,
  scores jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents view own sessions" ON public.coaching_sessions FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Supervisors manage sessions" ON public.coaching_sessions FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'admin', 'supervisor'))
);
