-- v69: overtime rate per employee, overtime pay + period dates on payroll records
alter table public.profiles
  add column if not exists overtime_rate numeric not null default 200;

alter table public.payrolls
  add column if not exists overtime_pay  numeric not null default 0,
  add column if not exists period_start  date,
  add column if not exists period_end    date;
