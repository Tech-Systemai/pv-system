-- v67: add custom_items to payrolls for arbitrary line items (allowances, advances, etc.)
alter table public.payrolls
  add column if not exists custom_items jsonb not null default '[]'::jsonb;
