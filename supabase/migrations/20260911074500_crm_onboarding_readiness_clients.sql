alter table public.website_crm_onboarding_cases
  add column if not exists readiness_status text not null default 'pending' check (readiness_status in ('pending','ready','blocked','live')),
  add column if not exists readiness_checked_at timestamptz,
  add column if not exists readiness_checked_by text,
  add column if not exists readiness_notes text,
  add column if not exists actual_go_live_at timestamptz,
  add column if not exists go_live_by text,
  add column if not exists go_live_notes text;

create index if not exists website_crm_onboarding_readiness_idx
  on public.website_crm_onboarding_cases(readiness_status, target_go_live_date, updated_at desc);

create table if not exists public.website_crm_client_accounts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.website_leads(id) on delete cascade,
  onboarding_id uuid not null unique references public.website_crm_onboarding_cases(id) on delete cascade,
  opportunity_id uuid not null references public.website_crm_opportunities(id) on delete cascade,
  account_name text not null,
  status text not null default 'active' check (status in ('active','paused','offboarded')),
  owner text,
  commercial_owner text,
  activated_at timestamptz not null default now(),
  next_success_review_at timestamptz,
  renewal_date date,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_crm_client_accounts_status_idx
  on public.website_crm_client_accounts(status, activated_at desc);
create index if not exists website_crm_client_accounts_owner_idx
  on public.website_crm_client_accounts(owner, status);

alter table public.website_crm_client_accounts enable row level security;
revoke all on public.website_crm_client_accounts from anon, authenticated;
grant all on public.website_crm_client_accounts to service_role;

comment on column public.website_crm_onboarding_cases.readiness_status is
  'Operational go-live gate. Ready means required prerequisites were verified; live means the client has actually gone live.';
comment on table public.website_crm_client_accounts is
  'Portfolio of post-onboarding active client accounts. Created automatically when an onboarding dossier is moved to go-live.';

-- Backfill already-live/completed onboarding dossiers into the active-client portfolio.
insert into public.website_crm_client_accounts (
  lead_id,
  onboarding_id,
  opportunity_id,
  account_name,
  status,
  owner,
  commercial_owner,
  activated_at,
  created_by,
  updated_by
)
select
  c.lead_id,
  c.id,
  c.opportunity_id,
  coalesce(nullif(l.company,''), trim(concat_ws(' ', l.first_name, l.last_name)), o.name, 'Client MOONY'),
  'active',
  c.owner,
  c.commercial_owner,
  coalesce(c.completed_at, c.kickoff_at, c.updated_at, now()),
  'MOONY Migration',
  'MOONY Migration'
from public.website_crm_onboarding_cases c
join public.website_leads l on l.id = c.lead_id
join public.website_crm_opportunities o on o.id = c.opportunity_id
where c.status in ('live','completed')
on conflict (lead_id) do nothing;

update public.website_crm_onboarding_cases
set readiness_status = 'live',
    actual_go_live_at = coalesce(actual_go_live_at, completed_at, kickoff_at, updated_at)
where status in ('live','completed') and readiness_status <> 'live';
