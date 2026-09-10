create table if not exists public.website_crm_activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references public.website_leads(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note','call','email','whatsapp','meeting','status','proposal','system')),
  summary text not null,
  body text,
  outcome text,
  created_by text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists website_crm_activities_lead_idx on public.website_crm_activities(lead_id, created_at desc);
create index if not exists website_crm_activities_kind_idx on public.website_crm_activities(kind);

create table if not exists public.website_crm_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references public.website_leads(id) on delete cascade,
  title text not null,
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo','in_progress','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to text,
  notes text,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists website_crm_tasks_lead_idx on public.website_crm_tasks(lead_id, due_at asc nulls last);
create index if not exists website_crm_tasks_status_idx on public.website_crm_tasks(status, due_at asc nulls last);

alter table public.website_crm_activities enable row level security;
alter table public.website_crm_tasks enable row level security;

comment on table public.website_crm_activities is 'Commercial timeline for MOONY leads: notes, calls, emails, WhatsApp exchanges, meetings and pipeline changes.';
comment on table public.website_crm_tasks is 'Commercial follow-up tasks attached to MOONY leads.';