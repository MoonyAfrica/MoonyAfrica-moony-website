alter table public.website_crm_client_accounts
  add column if not exists retention_last_health_status text check (retention_last_health_status is null or retention_last_health_status in ('healthy','watch','at_risk','critical')),
  add column if not exists retention_last_health_checked_at timestamptz;

create table if not exists public.website_crm_retention_settings (
  id text primary key default 'default',
  enabled boolean not null default false,
  health_risk_enabled boolean not null default true,
  nps_detractor_enabled boolean not null default true,
  renewal_enabled boolean not null default true,
  expansion_enabled boolean not null default true,
  expansion_adoption_threshold integer not null default 85 check (expansion_adoption_threshold between 50 and 100),
  renewal_day_1 integer not null default 60 check (renewal_day_1 between 1 and 365),
  renewal_day_2 integer not null default 30 check (renewal_day_2 between 1 and 365),
  renewal_day_3 integer not null default 15 check (renewal_day_3 between 1 and 365),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.website_crm_retention_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.website_crm_retention_cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('health_risk','nps_detractor')),
  trigger_key text not null,
  title text not null,
  status text not null default 'open' check (status in ('open','in_progress','recovered','closed')),
  priority text not null default 'high' check (priority in ('high','urgent')),
  owner text,
  opened_at timestamptz not null default now(),
  due_at timestamptz,
  recovered_at timestamptz,
  trigger_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, trigger_key)
);

create table if not exists public.website_crm_retention_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('health_risk','nps_detractor','renewal','expansion')),
  trigger_key text not null,
  status text not null default 'partial' check (status in ('success','partial','failed','skipped')),
  summary text,
  actions jsonb not null default '[]'::jsonb,
  executed_at timestamptz not null default now(),
  unique (client_id, trigger_key)
);

create index if not exists website_crm_retention_cases_status_idx
  on public.website_crm_retention_cases(status, priority, due_at asc nulls last);
create index if not exists website_crm_retention_cases_client_idx
  on public.website_crm_retention_cases(client_id, opened_at desc);
create index if not exists website_crm_retention_runs_client_idx
  on public.website_crm_retention_runs(client_id, executed_at desc);
create index if not exists website_crm_retention_runs_trigger_idx
  on public.website_crm_retention_runs(trigger_type, executed_at desc);

alter table public.website_crm_retention_settings enable row level security;
alter table public.website_crm_retention_cases enable row level security;
alter table public.website_crm_retention_runs enable row level security;

revoke all on public.website_crm_retention_settings from anon, authenticated;
revoke all on public.website_crm_retention_cases from anon, authenticated;
revoke all on public.website_crm_retention_runs from anon, authenticated;
grant all on public.website_crm_retention_settings to service_role;
grant all on public.website_crm_retention_cases to service_role;
grant all on public.website_crm_retention_runs to service_role;

comment on table public.website_crm_retention_settings is
  'Human-controlled Customer Success retention automation settings. Master automation is disabled by default.';
comment on table public.website_crm_retention_cases is
  'Operational recovery cases created from explicit Customer Success signals such as health deterioration or detractor feedback.';
comment on table public.website_crm_retention_runs is
  'Idempotency and execution history for retention, renewal and expansion triggers.';
comment on column public.website_crm_client_accounts.retention_last_health_status is
  'Previous operational Customer Success status used only to detect a status transition. It is not a medical or demographic inference.';
