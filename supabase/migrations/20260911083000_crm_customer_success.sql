alter table public.website_crm_client_accounts
  add column if not exists health_score integer not null default 75 check (health_score between 0 and 100),
  add column if not exists health_status text not null default 'watch' check (health_status in ('healthy','watch','at_risk','critical')),
  add column if not exists health_updated_at timestamptz,
  add column if not exists health_summary text,
  add column if not exists adoption_score integer check (adoption_score is null or adoption_score between 0 and 100),
  add column if not exists last_success_contact_at timestamptz,
  add column if not exists last_nps_score integer check (last_nps_score is null or last_nps_score between 0 and 10),
  add column if not exists last_nps_at timestamptz,
  add column if not exists churn_risk_notes text,
  add column if not exists renewal_probability integer not null default 70 check (renewal_probability between 0 and 100),
  add column if not exists expansion_potential text not null default 'medium' check (expansion_potential in ('low','medium','high'));

update public.website_crm_client_accounts
set last_success_contact_at = coalesce(last_success_contact_at, activated_at),
    next_success_review_at = coalesce(next_success_review_at, activated_at + interval '30 days')
where status = 'active';

create index if not exists website_crm_client_accounts_health_idx
  on public.website_crm_client_accounts(status, health_status, health_score);
create index if not exists website_crm_client_accounts_review_idx
  on public.website_crm_client_accounts(status, next_success_review_at);
create index if not exists website_crm_client_accounts_renewal_idx
  on public.website_crm_client_accounts(status, renewal_date);

create table if not exists public.website_crm_client_success_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  event_type text not null check (event_type in ('review','note','adoption','nps','risk','renewal','expansion','support','health')),
  title text not null,
  detail text,
  score_delta integer,
  actor text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.website_crm_client_surveys (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  survey_type text not null default 'nps' check (survey_type in ('nps','csat')),
  status text not null default 'sent' check (status in ('sent','opened','responded','expired','cancelled')),
  public_token_hash text not null,
  sent_to_email text not null,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  responded_at timestamptz,
  score integer check (score is null or score between 0 and 10),
  comment text,
  respondent_name text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_client_growth_opportunities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  kind text not null check (kind in ('renewal','upsell','cross_sell')),
  status text not null default 'open' check (status in ('open','planned','won','lost','dismissed')),
  title text not null,
  estimated_value numeric(14,2) not null default 0 check (estimated_value >= 0),
  currency text not null default 'XOF',
  due_date date,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_crm_client_success_events_idx
  on public.website_crm_client_success_events(client_id, occurred_at desc);
create index if not exists website_crm_client_surveys_idx
  on public.website_crm_client_surveys(client_id, sent_at desc);
create index if not exists website_crm_client_surveys_status_idx
  on public.website_crm_client_surveys(status, expires_at);
create index if not exists website_crm_client_growth_idx
  on public.website_crm_client_growth_opportunities(client_id, status, due_date);

alter table public.website_crm_client_success_events enable row level security;
alter table public.website_crm_client_surveys enable row level security;
alter table public.website_crm_client_growth_opportunities enable row level security;

revoke all on public.website_crm_client_success_events from anon, authenticated;
revoke all on public.website_crm_client_surveys from anon, authenticated;
revoke all on public.website_crm_client_growth_opportunities from anon, authenticated;
grant all on public.website_crm_client_success_events to service_role;
grant all on public.website_crm_client_surveys to service_role;
grant all on public.website_crm_client_growth_opportunities to service_role;

comment on column public.website_crm_client_accounts.health_score is
  'Transparent operational Customer Success score from 0 to 100. It is not a medical, financial or demographic inference.';
comment on column public.website_crm_client_accounts.adoption_score is
  'Manually supplied operational adoption estimate from 0 to 100; null means adoption has not yet been assessed.';
comment on column public.website_crm_client_accounts.churn_risk_notes is
  'Explicit operational risk notes recorded by the MOONY team. No browsing-derived demographic inference is used.';
comment on column public.website_crm_client_surveys.public_token_hash is
  'SHA-256 hash only. The raw client feedback token is never stored.';
comment on table public.website_crm_client_growth_opportunities is
  'Customer Success renewal, upsell and cross-sell opportunities kept separate from the original acquisition deal.';
