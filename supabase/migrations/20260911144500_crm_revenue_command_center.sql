create table if not exists public.website_crm_revenue_snapshots (
  id uuid primary key default gen_random_uuid(),
  period_month date not null,
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  subscription_id uuid not null references public.website_crm_account_subscriptions(id) on delete cascade,
  account_name text not null,
  owner text,
  country text,
  product_name text not null,
  currency text not null check (char_length(currency) = 3),
  mrr numeric(14,2) not null default 0 check (mrr >= 0),
  arr numeric(14,2) not null default 0 check (arr >= 0),
  billing_model text not null,
  subscription_status text not null,
  source_updated_at timestamptz,
  captured_at timestamptz not null default now(),
  captured_by text,
  unique(period_month, subscription_id),
  check (period_month = date_trunc('month', period_month)::date)
);

create table if not exists public.website_crm_revenue_command_settings (
  id text primary key default 'default',
  alerts_enabled boolean not null default false,
  nrr_floor_percent numeric(6,2) not null default 90 check (nrr_floor_percent between 0 and 200),
  top_client_concentration_percent numeric(6,2) not null default 35 check (top_client_concentration_percent between 1 and 100),
  overdue_ratio_percent numeric(6,2) not null default 20 check (overdue_ratio_percent between 0 and 100),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.website_crm_revenue_command_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.website_crm_revenue_command_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_key text not null unique,
  trigger_type text not null check (trigger_type in ('snapshot','nrr_below_floor','client_concentration','overdue_ratio')),
  currency text,
  status text not null default 'success' check (status in ('success','skipped','failed')),
  summary text,
  created_at timestamptz not null default now()
);

create index if not exists website_crm_revenue_snapshots_period_idx
  on public.website_crm_revenue_snapshots(period_month desc, currency, client_id);
create index if not exists website_crm_revenue_snapshots_client_idx
  on public.website_crm_revenue_snapshots(client_id, period_month desc);
create index if not exists website_crm_revenue_snapshots_subscription_idx
  on public.website_crm_revenue_snapshots(subscription_id, period_month desc);
create index if not exists website_crm_revenue_command_runs_created_idx
  on public.website_crm_revenue_command_runs(created_at desc);

alter table public.website_crm_revenue_snapshots enable row level security;
alter table public.website_crm_revenue_command_settings enable row level security;
alter table public.website_crm_revenue_command_runs enable row level security;

revoke all on public.website_crm_revenue_snapshots from anon, authenticated;
revoke all on public.website_crm_revenue_command_settings from anon, authenticated;
revoke all on public.website_crm_revenue_command_runs from anon, authenticated;
grant all on public.website_crm_revenue_snapshots to service_role;
grant all on public.website_crm_revenue_command_settings to service_role;
grant all on public.website_crm_revenue_command_runs to service_role;

comment on table public.website_crm_revenue_snapshots is
  'Monthly immutable-style revenue baselines built only from explicit active subscription terms. No health, demographic, browsing or inferred user data is used.';
comment on column public.website_crm_revenue_snapshots.mrr is
  'Monthly recurring revenue normalized from the explicit contractual recurring amount and billing cadence. Custom cadence contributes zero unless a monthly equivalent is explicitly represented elsewhere.';
comment on table public.website_crm_revenue_command_settings is
  'Internal executive revenue thresholds. Alerts are disabled by default and never trigger client communication or commercial action automatically.';
comment on table public.website_crm_revenue_command_runs is
  'Idempotency log for monthly snapshot capture and internal executive revenue alerts.';
