alter table public.website_crm_client_accounts
  add column if not exists governance_score integer not null default 50 check (governance_score between 0 and 100),
  add column if not exists governance_status text not null default 'watch' check (governance_status in ('healthy','watch','at_risk','critical')),
  add column if not exists governance_summary text,
  add column if not exists governance_updated_at timestamptz;

create table if not exists public.website_crm_account_stakeholders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  source_opportunity_contact_id uuid unique references public.website_crm_opportunity_contacts(id) on delete set null,
  name text not null,
  email text,
  phone text,
  role_title text,
  stakeholder_role text not null default 'other' check (stakeholder_role in ('executive_sponsor','economic_buyer','champion','influencer','procurement','legal','operational','blocker','user','other')),
  influence text not null default 'medium' check (influence in ('high','medium','low')),
  sentiment text not null default 'unknown' check (sentiment in ('supportive','neutral','resistant','unknown')),
  relationship_strength integer check (relationship_strength is null or relationship_strength between 0 and 100),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  contact_cadence_days integer not null default 30 check (contact_cadence_days between 1 and 365),
  last_contact_at timestamptz,
  next_contact_at timestamptz,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_stakeholder_interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  stakeholder_id uuid not null references public.website_crm_account_stakeholders(id) on delete cascade,
  channel text not null default 'note' check (channel in ('email','call','meeting','whatsapp','note')),
  summary text not null,
  outcome text,
  occurred_at timestamptz not null default now(),
  next_followup_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.website_crm_governance_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  trigger_key text not null,
  trigger_type text not null check (trigger_type in ('single_contact','missing_sponsor','contact_due','relationship_risk')),
  status text not null default 'success' check (status in ('success','skipped','failed')),
  summary text,
  created_at timestamptz not null default now(),
  unique (client_id, trigger_key)
);

create index if not exists website_crm_account_stakeholders_client_idx
  on public.website_crm_account_stakeholders(client_id, is_active desc, influence, stakeholder_role);
create index if not exists website_crm_account_stakeholders_contact_idx
  on public.website_crm_account_stakeholders(client_id, next_contact_at, last_contact_at);
create index if not exists website_crm_stakeholder_interactions_idx
  on public.website_crm_stakeholder_interactions(client_id, occurred_at desc);
create index if not exists website_crm_governance_runs_idx
  on public.website_crm_governance_runs(client_id, created_at desc);
create index if not exists website_crm_client_accounts_governance_idx
  on public.website_crm_client_accounts(status, governance_status, governance_score);

alter table public.website_crm_account_stakeholders enable row level security;
alter table public.website_crm_stakeholder_interactions enable row level security;
alter table public.website_crm_governance_runs enable row level security;

revoke all on public.website_crm_account_stakeholders from anon, authenticated;
revoke all on public.website_crm_stakeholder_interactions from anon, authenticated;
revoke all on public.website_crm_governance_runs from anon, authenticated;
grant all on public.website_crm_account_stakeholders to service_role;
grant all on public.website_crm_stakeholder_interactions to service_role;
grant all on public.website_crm_governance_runs to service_role;

insert into public.website_crm_account_stakeholders (
  client_id, source_opportunity_contact_id, name, email, phone, role_title,
  stakeholder_role, influence, is_primary, notes, created_by, updated_by
)
select
  account.id,
  contact.id,
  contact.name,
  contact.email,
  contact.phone,
  contact.role_title,
  case contact.buying_role
    when 'decision_maker' then 'economic_buyer'
    when 'champion' then 'champion'
    when 'influencer' then 'influencer'
    when 'procurement' then 'procurement'
    when 'legal' then 'legal'
    when 'user' then 'user'
    else 'other'
  end,
  contact.influence,
  contact.is_primary,
  contact.notes,
  'MOONY Migration',
  'MOONY Migration'
from public.website_crm_client_accounts account
join public.website_crm_opportunity_contacts contact
  on contact.opportunity_id = account.opportunity_id
on conflict (source_opportunity_contact_id) do nothing;

comment on column public.website_crm_client_accounts.governance_score is
  'Operational relationship-governance score based only on explicitly recorded account contacts, roles and contact cadence.';
comment on table public.website_crm_account_stakeholders is
  'Account stakeholder map for Customer Success governance. Sentiment and relationship strength are manually recorded, never inferred from browsing or sensitive data.';
comment on table public.website_crm_stakeholder_interactions is
  'Explicit relationship history for account stakeholders: calls, meetings, email, WhatsApp and notes.';
comment on table public.website_crm_governance_runs is
  'Idempotency log for internal account-governance alerts and follow-up tasks.';
