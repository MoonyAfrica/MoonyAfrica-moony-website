create table if not exists public.website_crm_onboarding_cases (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.website_crm_opportunities(id) on delete cascade,
  proposal_id uuid references public.website_crm_proposals(id) on delete set null,
  lead_id uuid not null references public.website_leads(id) on delete cascade,
  status text not null default 'handoff' check (status in ('handoff','contract','documents','kickoff','implementation','live','blocked','completed')),
  owner text,
  commercial_owner text,
  handoff_at timestamptz not null default now(),
  kickoff_at timestamptz,
  target_go_live_date date,
  completed_at timestamptz,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_contracts (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.website_crm_onboarding_cases(id) on delete cascade,
  proposal_id uuid references public.website_crm_proposals(id) on delete set null,
  reference text not null unique,
  version integer not null default 1 check (version > 0),
  title text not null,
  status text not null default 'draft' check (status in ('draft','ready','sent','signed','cancelled')),
  body text,
  effective_date date,
  signed_at timestamptz,
  signed_by text,
  signed_by_email text,
  sent_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.website_crm_onboarding_cases(id) on delete cascade,
  template_key text,
  title text not null,
  category text not null default 'onboarding',
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done')),
  required boolean not null default true,
  owner text,
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(onboarding_id, template_key)
);

create table if not exists public.website_crm_onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.website_crm_onboarding_cases(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'required' check (status in ('required','requested','received','validated','rejected','not_applicable')),
  required boolean not null default true,
  due_at timestamptz,
  document_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_onboarding_events (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.website_crm_onboarding_cases(id) on delete cascade,
  event_type text not null,
  title text not null,
  detail text,
  actor text,
  created_at timestamptz not null default now()
);

create index if not exists website_crm_onboarding_cases_status_idx on public.website_crm_onboarding_cases(status, updated_at desc);
create index if not exists website_crm_onboarding_tasks_case_idx on public.website_crm_onboarding_tasks(onboarding_id, status, sort_order);
create index if not exists website_crm_onboarding_documents_case_idx on public.website_crm_onboarding_documents(onboarding_id, status);
create index if not exists website_crm_onboarding_events_case_idx on public.website_crm_onboarding_events(onboarding_id, created_at desc);
create index if not exists website_crm_contracts_case_idx on public.website_crm_contracts(onboarding_id, created_at desc);

alter table public.website_crm_onboarding_cases enable row level security;
alter table public.website_crm_contracts enable row level security;
alter table public.website_crm_onboarding_tasks enable row level security;
alter table public.website_crm_onboarding_documents enable row level security;
alter table public.website_crm_onboarding_events enable row level security;

revoke all on public.website_crm_onboarding_cases from anon, authenticated;
revoke all on public.website_crm_contracts from anon, authenticated;
revoke all on public.website_crm_onboarding_tasks from anon, authenticated;
revoke all on public.website_crm_onboarding_documents from anon, authenticated;
revoke all on public.website_crm_onboarding_events from anon, authenticated;
grant all on public.website_crm_onboarding_cases to service_role;
grant all on public.website_crm_contracts to service_role;
grant all on public.website_crm_onboarding_tasks to service_role;
grant all on public.website_crm_onboarding_documents to service_role;
grant all on public.website_crm_onboarding_events to service_role;

comment on table public.website_crm_onboarding_cases is 'Post-signature client handoff dossiers created from won CRM opportunities.';
comment on table public.website_crm_contracts is 'Operational contract records linked to onboarding. Contract text must be legally reviewed before external use.';
comment on column public.website_crm_onboarding_documents.document_url is 'Optional pointer to an existing approved document location; V7 tracks requirements and does not itself upload files.';

-- Backfill a dossier for already-won opportunities. Prefer their accepted proposal when available.
insert into public.website_crm_onboarding_cases (opportunity_id, proposal_id, lead_id, status, owner, commercial_owner, created_by, updated_by)
select o.id,
       p.id,
       o.lead_id,
       'handoff',
       null,
       o.owner,
       'MOONY Migration',
       'MOONY Migration'
from public.website_crm_opportunities o
left join lateral (
  select id from public.website_crm_proposals p0
  where p0.opportunity_id = o.id and p0.status = 'accepted'
  order by p0.accepted_at desc nulls last, p0.updated_at desc
  limit 1
) p on true
where o.stage = 'won'
on conflict (opportunity_id) do nothing;
