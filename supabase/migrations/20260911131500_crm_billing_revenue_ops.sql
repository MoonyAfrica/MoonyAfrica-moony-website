create table if not exists public.website_crm_account_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  catalog_item_id uuid references public.website_crm_catalog_items(id) on delete set null,
  name text not null,
  status text not null default 'active' check (status in ('active','paused','cancelled','ended')),
  billing_model text not null check (billing_model in ('monthly','quarterly','semiannual','annual','custom')),
  pricing_unit text not null default 'account' check (pricing_unit in ('account','professional','employee','seat','custom')),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  recurring_amount numeric(14,2) not null default 0 check (recurring_amount >= 0),
  currency text not null default 'XOF' check (char_length(currency) = 3),
  start_date date not null default current_date,
  end_date date,
  next_invoice_date date,
  billing_notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_billing_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  subscription_id uuid references public.website_crm_account_subscriptions(id) on delete set null,
  reference text not null unique,
  title text not null,
  status text not null default 'draft' check (status in ('draft','issued','paid','overdue','cancelled')),
  issue_date date,
  due_date date,
  paid_at timestamptz,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  currency text not null default 'XOF' check (char_length(currency) = 3),
  external_reference text,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_billing_settings (
  id text primary key default 'default',
  enabled boolean not null default false,
  upcoming_days integer not null default 7 check (upcoming_days between 1 and 90),
  overdue_grace_days integer not null default 0 check (overdue_grace_days between 0 and 30),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.website_crm_billing_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.website_crm_billing_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_key text not null unique,
  trigger_type text not null check (trigger_type in ('invoice_overdue','invoice_due','subscription_due')),
  source_id uuid,
  status text not null default 'success' check (status in ('success','skipped','failed')),
  summary text,
  created_at timestamptz not null default now()
);

create index if not exists website_crm_account_subscriptions_client_idx
  on public.website_crm_account_subscriptions(client_id, status, next_invoice_date);
create index if not exists website_crm_account_subscriptions_billing_idx
  on public.website_crm_account_subscriptions(status, billing_model, currency);
create index if not exists website_crm_billing_invoices_client_idx
  on public.website_crm_billing_invoices(client_id, status, due_date);
create index if not exists website_crm_billing_invoices_due_idx
  on public.website_crm_billing_invoices(status, due_date);
create index if not exists website_crm_billing_runs_created_idx
  on public.website_crm_billing_runs(created_at desc);

alter table public.website_crm_account_subscriptions enable row level security;
alter table public.website_crm_billing_invoices enable row level security;
alter table public.website_crm_billing_settings enable row level security;
alter table public.website_crm_billing_runs enable row level security;

revoke all on public.website_crm_account_subscriptions from anon, authenticated;
revoke all on public.website_crm_billing_invoices from anon, authenticated;
revoke all on public.website_crm_billing_settings from anon, authenticated;
revoke all on public.website_crm_billing_runs from anon, authenticated;
grant all on public.website_crm_account_subscriptions to service_role;
grant all on public.website_crm_billing_invoices to service_role;
grant all on public.website_crm_billing_settings to service_role;
grant all on public.website_crm_billing_runs to service_role;

comment on table public.website_crm_account_subscriptions is
  'Operational recurring-revenue records for active MOONY client accounts. Pricing, quantity and recurring amount are explicitly validated by the MOONY team and are not inferred from sensitive data.';
comment on column public.website_crm_account_subscriptions.recurring_amount is
  'Contractual recurring amount for one billing period, entered or confirmed by a human. Custom cadence is excluded from automatic MRR normalization.';
comment on table public.website_crm_billing_invoices is
  'Internal invoice register. V8.7 never sends or issues invoices automatically; external delivery remains a deliberate human action.';
comment on table public.website_crm_billing_settings is
  'Human-controlled internal billing alerts. Disabled by default and never used to contact a client automatically.';
comment on table public.website_crm_billing_runs is
  'Idempotency history for internal due-date and overdue billing alerts.';
