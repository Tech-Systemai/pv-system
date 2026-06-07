-- v68: per-employee currency, start date, training end date, and first pay date
alter table public.profiles
  add column if not exists currency          text not null default 'USD',
  add column if not exists start_date        date,
  add column if not exists training_end_date date,
  add column if not exists first_pay_date    date;
