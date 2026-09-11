create table if not exists public.website_crm_success_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.website_crm_client_accounts(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft','active','paused','completed')),
  success_definition text,
  owner text,
  customer_owner text,
  start_date date not null default current_date,
  target_date date,
  cadence_days integer not null default 90 check (cadence_days between 14 and 365),
  overall_progress integer not null default 0 check (overall_progress between 0 and 100),
  last_review_at timestamptz,
  next_review_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_success_objectives (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.website_crm_success_plans(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'not_started' check (status in ('not_started','on_track','at_risk','blocked','achieved')),
  progress integer not null default 0 check (progress between 0 and 100),
  weight integer not null default 1 check (weight between 1 and 100),
  current_value numeric(14,2),
  target_value numeric(14,2),
  unit text,
  due_date date,
  owner_type text not null default 'shared' check (owner_type in ('moony','client','shared')),
  owner_name text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_qbrs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  plan_id uuid not null references public.website_crm_success_plans(id) on delete cascade,
  review_key text not null,
  status text not null default 'planned' check (status in ('planned','preparing','completed','cancelled')),
  scheduled_at timestamptz,
  period_start date,
  period_end date,
  executive_summary text,
  wins text,
  risks text,
  decisions text,
  next_steps text,
  adoption_snapshot integer check (adoption_snapshot is null or adoption_snapshot between 0 and 100),
  nps_snapshot integer check (nps_snapshot is null or nps_snapshot between 0 and 10),
  health_snapshot integer check (health_snapshot is null or health_snapshot between 0 and 100),
  prepared_at timestamptz,
  completed_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, review_key)
);

create table if not exists public.website_crm_qbr_actions (
  id uuid primary key default gen_random_uuid(),
  qbr_id uuid not null references public.website_crm_qbrs(id) on delete cascade,
  title text not null,
  owner_name text,
  due_date date,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  completed_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_crm_success_plans_review_idx
  on public.website_crm_success_plans(status, next_review_at);
create index if not exists website_crm_success_objectives_plan_idx
  on public.website_crm_success_objectives(plan_id, status, due_date);
create index if not exists website_crm_qbrs_client_idx
  on public.website_crm_qbrs(client_id, scheduled_at desc nulls last);
create index if not exists website_crm_qbrs_status_idx
  on public.website_crm_qbrs(status, scheduled_at);
create index if not exists website_crm_qbr_actions_qbr_idx
  on public.website_crm_qbr_actions(qbr_id, status, due_date);

alter table public.website_crm_success_plans enable row level security;
alter table public.website_crm_success_objectives enable row level security;
alter table public.website_crm_qbrs enable row level security;
alter table public.website_crm_qbr_actions enable row level security;

revoke all on public.website_crm_success_plans from anon, authenticated;
revoke all on public.website_crm_success_objectives from anon, authenticated;
revoke all on public.website_crm_qbrs from anon, authenticated;
revoke all on public.website_crm_qbr_actions from anon, authenticated;
grant all on public.website_crm_success_plans to service_role;
grant all on public.website_crm_success_objectives to service_role;
grant all on public.website_crm_qbrs to service_role;
grant all on public.website_crm_qbr_actions to service_role;

comment on table public.website_crm_success_plans is
  'Shared operational success plans for active MOONY client accounts. Goals and review cadence are explicitly recorded by the team.';
comment on table public.website_crm_success_objectives is
  'Measurable objectives attached to a customer success plan, with explicit ownership and progress.';
comment on table public.website_crm_qbrs is
  'Quarterly/business review workspace with operational snapshots, decisions and next steps. No health or demographic inference beyond existing Customer Success fields.';
comment on table public.website_crm_qbr_actions is
  'Human-owned action items agreed during customer reviews.';
