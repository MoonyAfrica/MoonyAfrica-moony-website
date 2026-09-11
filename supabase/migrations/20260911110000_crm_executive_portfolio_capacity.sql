alter table public.website_crm_client_accounts
  add column if not exists portfolio_tier text not null default 'standard' check (portfolio_tier in ('strategic','growth','standard','light_touch')),
  add column if not exists service_effort_hours_monthly numeric(8,2) check (service_effort_hours_monthly is null or service_effort_hours_monthly between 0 and 500),
  add column if not exists portfolio_notes text,
  add column if not exists portfolio_updated_at timestamptz,
  add column if not exists portfolio_updated_by text;

create table if not exists public.website_crm_csm_capacity_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_name text not null unique,
  weekly_capacity_hours numeric(8,2) not null check (weekly_capacity_hours > 0 and weekly_capacity_hours <= 168),
  active boolean not null default true,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_portfolio_action_states (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  action_key text not null,
  status text not null default 'open' check (status in ('open','done','snoozed','dismissed')),
  snoozed_until timestamptz,
  note text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, action_key)
);

create index if not exists website_crm_client_accounts_portfolio_idx
  on public.website_crm_client_accounts(status, portfolio_tier, health_status, governance_status);
create index if not exists website_crm_csm_capacity_profiles_owner_idx
  on public.website_crm_csm_capacity_profiles(active, owner_name);
create index if not exists website_crm_portfolio_action_states_idx
  on public.website_crm_portfolio_action_states(status, snoozed_until, updated_at desc);

alter table public.website_crm_csm_capacity_profiles enable row level security;
alter table public.website_crm_portfolio_action_states enable row level security;

revoke all on public.website_crm_csm_capacity_profiles from anon, authenticated;
revoke all on public.website_crm_portfolio_action_states from anon, authenticated;
grant all on public.website_crm_csm_capacity_profiles to service_role;
grant all on public.website_crm_portfolio_action_states to service_role;

comment on column public.website_crm_client_accounts.portfolio_tier is
  'Explicit Customer Success portfolio classification chosen by the MOONY team. Strategic status is never inferred from sensitive user data.';
comment on column public.website_crm_client_accounts.service_effort_hours_monthly is
  'Optional manual monthly Customer Success effort estimate. When null, the executive portfolio may show a transparent planning estimate based on portfolio tier.';
comment on table public.website_crm_csm_capacity_profiles is
  'Human-configured weekly Customer Success capacity by owner. No capacity is assumed until a profile is configured.';
comment on table public.website_crm_portfolio_action_states is
  'State for dynamically generated executive portfolio actions, allowing the team to complete, snooze or dismiss a recommendation without hiding underlying CRM signals.';
