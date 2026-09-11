create table if not exists public.website_crm_escalation_settings (
  id text primary key default 'default',
  enabled boolean not null default false,
  health_critical_enabled boolean not null default true,
  governance_critical_enabled boolean not null default true,
  strategic_risk_enabled boolean not null default true,
  renewal_overdue_enabled boolean not null default true,
  retention_urgent_enabled boolean not null default true,
  critical_sla_hours integer not null default 24 check (critical_sla_hours between 1 and 336),
  high_sla_hours integer not null default 72 check (high_sla_hours between 1 and 720),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.website_crm_escalation_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.website_crm_escalation_cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  source_type text not null check (source_type in ('manual','health','governance','strategic','renewal','retention')),
  source_key text not null,
  title text not null,
  summary text,
  severity text not null default 'high' check (severity in ('medium','high','critical')),
  status text not null default 'open' check (status in ('open','triage','action_plan','monitoring','resolved','closed')),
  owner text,
  executive_owner text,
  opened_at timestamptz not null default now(),
  due_at timestamptz,
  next_review_at timestamptz,
  resolved_at timestamptz,
  root_cause text,
  resolution_summary text,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, source_key)
);

create table if not exists public.website_crm_escalation_actions (
  id uuid primary key default gen_random_uuid(),
  escalation_id uuid not null references public.website_crm_escalation_cases(id) on delete cascade,
  title text not null,
  detail text,
  owner text,
  priority text not null default 'high' check (priority in ('normal','high','urgent')),
  status text not null default 'todo' check (status in ('todo','in_progress','done','cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_escalation_updates (
  id uuid primary key default gen_random_uuid(),
  escalation_id uuid not null references public.website_crm_escalation_cases(id) on delete cascade,
  update_type text not null default 'note' check (update_type in ('note','decision','risk','progress','resolution')),
  body text not null,
  actor text,
  created_at timestamptz not null default now()
);

create index if not exists website_crm_escalation_cases_status_idx
  on public.website_crm_escalation_cases(status, severity, due_at asc nulls last);
create index if not exists website_crm_escalation_cases_client_idx
  on public.website_crm_escalation_cases(client_id, opened_at desc);
create index if not exists website_crm_escalation_actions_case_idx
  on public.website_crm_escalation_actions(escalation_id, status, due_at asc nulls last);
create index if not exists website_crm_escalation_updates_case_idx
  on public.website_crm_escalation_updates(escalation_id, created_at desc);

alter table public.website_crm_escalation_settings enable row level security;
alter table public.website_crm_escalation_cases enable row level security;
alter table public.website_crm_escalation_actions enable row level security;
alter table public.website_crm_escalation_updates enable row level security;

revoke all on public.website_crm_escalation_settings from anon, authenticated;
revoke all on public.website_crm_escalation_cases from anon, authenticated;
revoke all on public.website_crm_escalation_actions from anon, authenticated;
revoke all on public.website_crm_escalation_updates from anon, authenticated;
grant all on public.website_crm_escalation_settings to service_role;
grant all on public.website_crm_escalation_cases to service_role;
grant all on public.website_crm_escalation_actions to service_role;
grant all on public.website_crm_escalation_updates to service_role;

comment on table public.website_crm_escalation_settings is
  'Human-controlled internal Customer Success escalation automation. It is disabled by default and never sends client communications.';
comment on table public.website_crm_escalation_cases is
  'Internal intervention room for operational Customer Success risks. Sources are explicit CRM signals only; no medical, demographic or browsing inference is permitted.';
comment on table public.website_crm_escalation_actions is
  'Action plan attached to an internal escalation case. Actions require human ownership and execution.';
comment on table public.website_crm_escalation_updates is
  'Human-entered decision and progress log for Customer Success escalation cases.';
