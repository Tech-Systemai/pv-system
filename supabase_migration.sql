-- ============================================================
-- Pioneers Veneers — Full Database Migration (idempotent)
-- Safe to run on a fresh DB or one that already has tables.
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- ── 1. PROFILES ──────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade
);
alter table profiles add column if not exists name        text;
alter table profiles add column if not exists email       text;
alter table profiles add column if not exists role        user_role not null default 'sales';
alter table profiles add column if not exists department  text;
alter table profiles add column if not exists location    text;
alter table profiles add column if not exists salary      numeric default 2500;
alter table profiles add column if not exists points      integer default 7;
alter table profiles add column if not exists clocked_in  boolean default false;
alter table profiles add column if not exists clock_in_time  timestamptz;
alter table profiles add column if not exists clock_out_time timestamptz;
alter table profiles add column if not exists status      text default 'Active';
alter table profiles add column if not exists created_at  timestamptz default now();
alter table profiles disable row level security;

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'sales')::text::user_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 2. ATTENDANCE LOGS ────────────────────────────────────────
create table if not exists attendance_logs (
  id uuid primary key default gen_random_uuid()
);
alter table attendance_logs add column if not exists user_id                 uuid references profiles on delete cascade;
alter table attendance_logs add column if not exists date                    date;
alter table attendance_logs add column if not exists clock_in_time           timestamptz;
alter table attendance_logs add column if not exists clock_out_time          timestamptz;
alter table attendance_logs add column if not exists status                  text default 'present';
alter table attendance_logs add column if not exists productive_time_minutes integer default 0;
alter table attendance_logs add column if not exists created_at              timestamptz default now();
alter table attendance_logs disable row level security;

-- ── 3. AUDIT LOGS ─────────────────────────────────────────────
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid()
);
alter table audit_logs add column if not exists user_id    uuid references profiles on delete set null;
alter table audit_logs add column if not exists action     text;
alter table audit_logs add column if not exists table_name text;
alter table audit_logs add column if not exists record_id  text;
alter table audit_logs add column if not exists created_at timestamptz default now();
alter table audit_logs disable row level security;

-- ── 4. BRAND SETTINGS ────────────────────────────────────────
create table if not exists brand_settings (
  id text primary key default 'main'
);
alter table brand_settings add column if not exists company_name    text default 'Pioneers Veneers';
alter table brand_settings add column if not exists tagline         text default 'Excellence in Every Smile';
alter table brand_settings add column if not exists primary_color   text default '#4f46e5';
alter table brand_settings add column if not exists footer_text     text;
alter table brand_settings add column if not exists logo_base64     text;
alter table brand_settings add column if not exists apply_payslips  boolean default true;
alter table brand_settings add column if not exists apply_contracts boolean default true;
alter table brand_settings add column if not exists apply_reports   boolean default true;
alter table brand_settings add column if not exists created_at      timestamptz default now();
alter table brand_settings disable row level security;

-- ── 5. COACHING SESSIONS ──────────────────────────────────────
create table if not exists coaching_sessions (
  id uuid primary key default gen_random_uuid()
);
alter table coaching_sessions add column if not exists agent_id      uuid references profiles on delete cascade;
alter table coaching_sessions add column if not exists supervisor_id uuid references profiles on delete set null;
alter table coaching_sessions add column if not exists type          text default 'Performance';
alter table coaching_sessions add column if not exists notes         text;
alter table coaching_sessions add column if not exists action_plan   text;
alter table coaching_sessions add column if not exists next_review   date;
alter table coaching_sessions add column if not exists scores        jsonb default '{}'::jsonb;
alter table coaching_sessions add column if not exists created_at    timestamptz default now();
alter table coaching_sessions disable row level security;

-- ── 6. CONTRACTS ──────────────────────────────────────────────
create table if not exists contracts (
  id uuid primary key default gen_random_uuid()
);
alter table contracts add column if not exists user_id        uuid references profiles on delete cascade;
alter table contracts add column if not exists type           text;
alter table contracts add column if not exists effective_date date;
alter table contracts add column if not exists end_date       date;
alter table contracts add column if not exists status         text default 'Pending';
alter table contracts add column if not exists content        text;
alter table contracts add column if not exists created_at     timestamptz default now();
alter table contracts disable row level security;

-- ── 7. FINANCE ENTRIES ────────────────────────────────────────
create table if not exists finance_entries (
  id uuid primary key default gen_random_uuid()
);
alter table finance_entries add column if not exists category    text;
alter table finance_entries add column if not exists description text;
alter table finance_entries add column if not exists amount      numeric;
alter table finance_entries add column if not exists entry_type  text default 'expense';
alter table finance_entries add column if not exists created_at  timestamptz default now();
alter table finance_entries disable row level security;

-- ── 8. HR APPLICANTS ──────────────────────────────────────────
create table if not exists hr_applicants (
  id uuid primary key default gen_random_uuid()
);
alter table hr_applicants add column if not exists name       text;
alter table hr_applicants add column if not exists email      text;
alter table hr_applicants add column if not exists position   text;
alter table hr_applicants add column if not exists score      integer default 80;
alter table hr_applicants add column if not exists status     text default 'Reviewing';
alter table hr_applicants add column if not exists created_at timestamptz default now();
alter table hr_applicants disable row level security;

-- ── 9. INBOX DOCUMENTS ────────────────────────────────────────
create table if not exists inbox_documents (
  id uuid primary key default gen_random_uuid()
);
alter table inbox_documents add column if not exists user_id            uuid references profiles on delete cascade;
alter table inbox_documents add column if not exists title              text;
alter table inbox_documents add column if not exists subject            text;
alter table inbox_documents add column if not exists content            text;
alter table inbox_documents add column if not exists type               text default 'Notice';
alter table inbox_documents add column if not exists sender             text;
alter table inbox_documents add column if not exists requires_signature boolean default false;
alter table inbox_documents add column if not exists is_read            boolean default false;
alter table inbox_documents add column if not exists is_signed          boolean default false;
alter table inbox_documents add column if not exists signed_by          text;
alter table inbox_documents add column if not exists created_at         timestamptz default now();
alter table inbox_documents disable row level security;

-- ── 10. KNOWLEDGE BASE ────────────────────────────────────────
create table if not exists knowledge_base (
  id uuid primary key default gen_random_uuid()
);
alter table knowledge_base add column if not exists folder       text;
alter table knowledge_base add column if not exists title        text;
alter table knowledge_base add column if not exists content      text;
alter table knowledge_base add column if not exists access_level text default 'Everyone';
alter table knowledge_base add column if not exists created_at   timestamptz default now();
alter table knowledge_base disable row level security;

-- ── 11. MESSAGES ──────────────────────────────────────────────
create table if not exists messages (
  id uuid primary key default gen_random_uuid()
);
alter table messages add column if not exists user_id     uuid references profiles on delete set null;
alter table messages add column if not exists channel     text;
alter table messages add column if not exists content     text;
alter table messages add column if not exists sender_name text;
alter table messages add column if not exists sender_role text;
alter table messages add column if not exists created_at  timestamptz default now();
alter table messages disable row level security;

-- Enable realtime for chat (safe to run multiple times)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

-- ── 12. PAYROLLS ──────────────────────────────────────────────
create table if not exists payrolls (
  id uuid primary key default gen_random_uuid()
);
alter table payrolls add column if not exists user_id     uuid references profiles on delete cascade;
alter table payrolls add column if not exists period      text;
alter table payrolls add column if not exists base_salary numeric default 2500;
alter table payrolls add column if not exists deductions  numeric default 0;
alter table payrolls add column if not exists bonuses     numeric default 0;
alter table payrolls add column if not exists net_pay     numeric;
alter table payrolls add column if not exists status      text default 'Draft';
alter table payrolls add column if not exists created_at  timestamptz default now();
alter table payrolls disable row level security;

-- ── 13. PERMISSIONS ───────────────────────────────────────────
create table if not exists permissions (
  id text primary key default 'main'
);
alter table permissions add column if not exists matrix     jsonb default '{}'::jsonb;
alter table permissions add column if not exists created_at timestamptz default now();
alter table permissions disable row level security;

-- ── 14. PLANNING DOCUMENTS ────────────────────────────────────
create table if not exists planning_documents (
  id uuid primary key default gen_random_uuid()
);
alter table planning_documents add column if not exists title      text;
alter table planning_documents add column if not exists content    text;
alter table planning_documents add column if not exists doc_type   text default 'Strategy';
alter table planning_documents add column if not exists created_at timestamptz default now();
alter table planning_documents disable row level security;

-- ── 15. POLICIES ──────────────────────────────────────────────
create table if not exists policies (
  id uuid primary key default gen_random_uuid()
);
alter table policies add column if not exists name           text;
alter table policies add column if not exists trigger        text;
alter table policies add column if not exists trigger_detail text;
alter table policies add column if not exists action         text;
alter table policies add column if not exists action_detail  text;
alter table policies add column if not exists active         boolean default true;
alter table policies add column if not exists executed       integer default 0;
alter table policies add column if not exists created_at     timestamptz default now();
alter table policies disable row level security;

-- ── 16. SALES LOGS ────────────────────────────────────────────
create table if not exists sales_logs (
  id uuid primary key default gen_random_uuid()
);
alter table sales_logs add column if not exists user_id     uuid references profiles on delete cascade;
alter table sales_logs add column if not exists customer_id text;
alter table sales_logs add column if not exists amount      numeric default 0;
alter table sales_logs add column if not exists type        text default 'Sale';
alter table sales_logs add column if not exists status      text default 'Pending';
alter table sales_logs add column if not exists created_at  timestamptz default now();
alter table sales_logs disable row level security;

-- ── 17. SCHEDULES ─────────────────────────────────────────────
create table if not exists schedules (
  id uuid primary key default gen_random_uuid()
);
alter table schedules add column if not exists user_id       uuid references profiles on delete cascade;
alter table schedules add column if not exists week          text;
alter table schedules add column if not exists day           text;
alter table schedules add column if not exists shift_start   text;
alter table schedules add column if not exists shift_end     text;
alter table schedules add column if not exists team          text;
alter table schedules add column if not exists affects_count integer;
alter table schedules add column if not exists status        text default 'Active';
alter table schedules add column if not exists created_at    timestamptz default now();
alter table schedules disable row level security;

-- ── 18. TARGETS ───────────────────────────────────────────────
create table if not exists targets (
  id uuid primary key default gen_random_uuid()
);
alter table targets add column if not exists user_id            uuid references profiles on delete cascade;
alter table targets add column if not exists period             text;
alter table targets add column if not exists sales_count_target integer default 50;
alter table targets add column if not exists revenue_target     numeric;
alter table targets add column if not exists created_at         timestamptz default now();
-- Add unique constraint only if it doesn't already exist
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'targets'::regclass and contype = 'u'
  ) then
    alter table targets add constraint targets_user_period_key unique (user_id, period);
  end if;
end $$;
alter table targets disable row level security;

-- ── 19. TASKS ─────────────────────────────────────────────────
create table if not exists tasks (
  id uuid primary key default gen_random_uuid()
);
alter table tasks add column if not exists title       text;
alter table tasks add column if not exists assigned_to uuid references profiles on delete cascade;
alter table tasks add column if not exists assigned_by uuid references profiles on delete set null;
alter table tasks add column if not exists due_date    date;
alter table tasks add column if not exists priority    text default 'Medium';
alter table tasks add column if not exists completed   boolean default false;
alter table tasks add column if not exists created_at  timestamptz default now();
alter table tasks disable row level security;

-- ── 20. TICKETS ───────────────────────────────────────────────
create table if not exists tickets (
  id uuid primary key default gen_random_uuid()
);
alter table tickets add column if not exists user_id     uuid references profiles on delete cascade;
alter table tickets add column if not exists subject     text;
alter table tickets add column if not exists description text;
alter table tickets add column if not exists priority    text default 'Medium';
alter table tickets add column if not exists status      text default 'Open';
alter table tickets add column if not exists resolved_by uuid references profiles on delete set null;
alter table tickets add column if not exists created_at  timestamptz default now();
alter table tickets disable row level security;

-- ── 21. TIME OFF REQUESTS ─────────────────────────────────────
create table if not exists time_off_requests (
  id uuid primary key default gen_random_uuid()
);
alter table time_off_requests add column if not exists user_id    uuid references profiles on delete cascade;
alter table time_off_requests add column if not exists type       text default 'Vacation';
alter table time_off_requests add column if not exists start_date date;
alter table time_off_requests add column if not exists end_date   date;
alter table time_off_requests add column if not exists reason     text;
alter table time_off_requests add column if not exists status     text default 'Pending';
alter table time_off_requests add column if not exists created_at timestamptz default now();
alter table time_off_requests disable row level security;

-- ── 22. NOTES ────────────────────────────────────────────────
create table if not exists notes (
  id uuid primary key default gen_random_uuid()
);
alter table notes add column if not exists user_id    uuid references profiles on delete cascade;
alter table notes add column if not exists title      text;
alter table notes add column if not exists content    text;
alter table notes add column if not exists type       text default 'General';
alter table notes add column if not exists created_at timestamptz default now();
alter table notes add column if not exists updated_at timestamptz default now();
alter table notes disable row level security;

-- ── BACKFILL: profile rows for existing auth users ────────────
insert into profiles (id, email, name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data->>'role', 'sales')::text::user_role
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Backfill email for existing profile rows that have a null email
update profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- ── SEED: Default policy rules ────────────────────────────────
insert into policies (name, trigger, trigger_detail, action, action_detail, active)
values
  ('Late Clock-In Penalty',    'Late clock-in (per 5 min)',       'Every 5 minutes late', 'Deduct points',          '-0.5 points', true),
  ('No-Show Penalty',          'Full day absence (no-show)',       null,                   'Deduct points',          '-2 points',   true),
  ('Low Productivity Warning', 'Low productivity (< 6h tracked)', '< 6h productive',      'Auto-notify supervisor', null,          true)
on conflict do nothing;

-- ============================================================
-- Done! All 21 tables created/updated. Refresh your browser.
-- ============================================================
