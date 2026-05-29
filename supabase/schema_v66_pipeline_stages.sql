-- v66: per-case pipeline stage tracking and exception flags
alter table public.cx_cases
  add column if not exists stages_done     text[] not null default '{}',
  add column if not exists exception_flags text[] not null default '{}';
