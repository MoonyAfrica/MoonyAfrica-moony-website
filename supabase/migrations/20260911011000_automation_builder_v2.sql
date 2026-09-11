create table if not exists public.control_center_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.control_center_automation_rules(id) on delete set null,
  run_id uuid references public.control_center_automation_runs(id) on delete set null,
  source_type text,
  source_id text,
  action jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','running','success','failed','cancelled')),
  attempts integer not null default 0,
  error text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists control_center_automation_jobs_due_idx
  on public.control_center_automation_jobs(status, scheduled_at);
create index if not exists control_center_automation_jobs_rule_idx
  on public.control_center_automation_jobs(rule_id, created_at desc);

alter table public.control_center_automation_jobs enable row level security;
