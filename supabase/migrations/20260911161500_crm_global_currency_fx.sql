create table if not exists public.website_crm_fx_settings (
  id text primary key default 'default',
  default_display_currency text not null default 'XOF' check (default_display_currency in ('EUR','XOF','CDF','GHS','CAD','USD')),
  provider text not null default 'frankfurter_v2',
  refresh_hours integer not null default 6 check (refresh_hours between 1 and 72),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.website_crm_fx_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.website_crm_fx_snapshots (
  id uuid primary key default gen_random_uuid(),
  requested_date date,
  base_currency text not null default 'EUR' check (base_currency in ('EUR','XOF','CDF','GHS','CAD','USD')),
  source text not null default 'frankfurter_v2',
  rates jsonb not null default '{}'::jsonb,
  rate_dates jsonb not null default '{}'::jsonb,
  providers jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  fetched_by text,
  metadata jsonb not null default '{}'::jsonb,
  check (jsonb_typeof(rates) = 'object'),
  check (jsonb_typeof(rate_dates) = 'object'),
  check (jsonb_typeof(providers) = 'object')
);

create index if not exists website_crm_fx_snapshots_current_idx
  on public.website_crm_fx_snapshots(source, base_currency, fetched_at desc)
  where requested_date is null;

create unique index if not exists website_crm_fx_snapshots_historical_idx
  on public.website_crm_fx_snapshots(requested_date, source, base_currency)
  where requested_date is not null;

alter table public.website_crm_fx_settings enable row level security;
alter table public.website_crm_fx_snapshots enable row level security;
revoke all on public.website_crm_fx_settings from anon, authenticated;
revoke all on public.website_crm_fx_snapshots from anon, authenticated;
grant all on public.website_crm_fx_settings to service_role;
grant all on public.website_crm_fx_snapshots to service_role;

comment on table public.website_crm_fx_settings is
  'CRM display-currency defaults and FX cache policy. The display currency never replaces the original transaction currency.';
comment on table public.website_crm_fx_snapshots is
  'Cached current and historical FX reference snapshots used for CRM display conversion and frozen executive reporting.';
comment on column public.website_crm_fx_snapshots.rates is
  'Reference rates relative to base_currency. Converted figures are indicative management views, not accounting journal amounts.';
comment on column public.website_crm_fx_snapshots.requested_date is
  'Null means a current-rate cache entry. Historical snapshots are immutable per requested date/source/base and may be reused by locked reports.';
