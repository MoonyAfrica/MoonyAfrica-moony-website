create table if not exists public.website_crm_contract_amendments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  contract_id uuid references public.website_crm_contracts(id) on delete set null,
  subscription_id uuid references public.website_crm_account_subscriptions(id) on delete set null,
  reference text not null unique,
  kind text not null default 'other' check (kind in ('upgrade','downgrade','pricing','quantity','scope','renewal','term','other')),
  status text not null default 'draft' check (status in ('draft','review','approved','signed','applied','cancelled')),
  title text not null,
  summary text,
  effective_date date not null,
  currency text check (currency is null or char_length(currency) = 3),
  new_billing_model text check (new_billing_model is null or new_billing_model in ('monthly','quarterly','semiannual','annual','custom')),
  new_quantity numeric(12,2) check (new_quantity is null or new_quantity > 0),
  new_unit_price numeric(14,2) check (new_unit_price is null or new_unit_price >= 0),
  new_discount_percent numeric(5,2) check (new_discount_percent is null or new_discount_percent between 0 and 100),
  new_recurring_amount numeric(14,2) check (new_recurring_amount is null or new_recurring_amount >= 0),
  new_subscription_end_date date,
  new_next_invoice_date date,
  new_renewal_date date,
  owner text,
  approved_at timestamptz,
  approved_by text,
  signed_at timestamptz,
  signed_by text,
  signed_by_email text,
  applied_at timestamptz,
  applied_by text,
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_subscription_change_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  subscription_id uuid not null references public.website_crm_account_subscriptions(id) on delete cascade,
  amendment_id uuid references public.website_crm_contract_amendments(id) on delete set null,
  change_type text not null,
  effective_date date not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  applied_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.website_crm_contract_lifecycle_settings (
  id text primary key default 'default',
  enabled boolean not null default false,
  upcoming_effective_days integer not null default 14 check (upcoming_effective_days between 1 and 180),
  unsigned_effective_grace_days integer not null default 0 check (unsigned_effective_grace_days between 0 and 30),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.website_crm_contract_lifecycle_settings (id) values ('default') on conflict (id) do nothing;

create table if not exists public.website_crm_contract_lifecycle_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_key text not null unique,
  trigger_type text not null check (trigger_type in ('effective_soon','effective_due','unsigned_due')),
  amendment_id uuid references public.website_crm_contract_amendments(id) on delete cascade,
  status text not null default 'success' check (status in ('success','skipped','failed')),
  summary text,
  created_at timestamptz not null default now()
);

create index if not exists website_crm_contract_amendments_client_idx on public.website_crm_contract_amendments(client_id,status,effective_date);
create index if not exists website_crm_contract_amendments_subscription_idx on public.website_crm_contract_amendments(subscription_id,status,effective_date);
create index if not exists website_crm_contract_amendments_contract_idx on public.website_crm_contract_amendments(contract_id,status,effective_date);
create index if not exists website_crm_subscription_change_events_idx on public.website_crm_subscription_change_events(subscription_id,effective_date desc,created_at desc);
create index if not exists website_crm_contract_lifecycle_runs_idx on public.website_crm_contract_lifecycle_runs(created_at desc);

alter table public.website_crm_contract_amendments enable row level security;
alter table public.website_crm_subscription_change_events enable row level security;
alter table public.website_crm_contract_lifecycle_settings enable row level security;
alter table public.website_crm_contract_lifecycle_runs enable row level security;
revoke all on public.website_crm_contract_amendments from anon, authenticated;
revoke all on public.website_crm_subscription_change_events from anon, authenticated;
revoke all on public.website_crm_contract_lifecycle_settings from anon, authenticated;
revoke all on public.website_crm_contract_lifecycle_runs from anon, authenticated;
grant all on public.website_crm_contract_amendments to service_role;
grant all on public.website_crm_subscription_change_events to service_role;
grant all on public.website_crm_contract_lifecycle_settings to service_role;
grant all on public.website_crm_contract_lifecycle_runs to service_role;

comment on table public.website_crm_contract_amendments is 'Explicit contract amendments for active MOONY accounts. Commercial terms are entered and validated by humans; sensitive user data is never used to infer an amendment.';
comment on table public.website_crm_subscription_change_events is 'Immutable operational history of subscription terms changed through an applied amendment.';
comment on table public.website_crm_contract_lifecycle_settings is 'Internal amendment alerts only. Disabled by default and never authorizes automatic application or client communication.';
comment on column public.website_crm_contract_amendments.after_snapshot is 'Snapshot of the explicitly requested future terms. Applying an amendment requires a deliberate human action after signature and effective date.';
