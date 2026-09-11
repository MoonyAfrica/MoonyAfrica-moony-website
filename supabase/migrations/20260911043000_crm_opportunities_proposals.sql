create table if not exists public.website_crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.website_leads(id) on delete cascade,
  legacy_key text unique,
  name text not null,
  stage text not null default 'new' check (stage in ('new','to_contact','contacted','appointment','proposal','negotiation','won','lost')),
  probability numeric(5,4) not null default 0.05 check (probability between 0 and 1),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  currency text not null default 'XOF' check (char_length(currency) = 3),
  expected_close_date date,
  owner text,
  next_step text,
  next_step_due_at timestamptz,
  loss_reason text,
  source text,
  notes text,
  created_by text,
  updated_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_opportunity_contacts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.website_crm_opportunities(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role_title text,
  buying_role text not null default 'other' check (buying_role in ('decision_maker','champion','influencer','procurement','legal','user','other')),
  influence text not null default 'medium' check (influence in ('high','medium','low')),
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_catalog_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text,
  description text,
  billing_model text not null default 'custom' check (billing_model in ('one_time','monthly','quarterly','semiannual','annual','custom')),
  currency text not null default 'XOF' check (char_length(currency) = 3),
  unit_price numeric(14,2) check (unit_price is null or unit_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_opportunity_items (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.website_crm_opportunities(id) on delete cascade,
  catalog_item_id uuid references public.website_crm_catalog_items(id) on delete set null,
  name text not null,
  description text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  billing_model text not null default 'custom' check (billing_model in ('one_time','monthly','quarterly','semiannual','annual','custom')),
  currency text not null default 'XOF' check (char_length(currency) = 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_proposals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.website_crm_opportunities(id) on delete cascade,
  reference text not null unique,
  version integer not null default 1 check (version > 0),
  title text not null,
  status text not null default 'draft' check (status in ('draft','sent','viewed','accepted','rejected','expired','superseded')),
  currency text not null default 'XOF' check (char_length(currency) = 3),
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  valid_until date,
  introduction text,
  terms text,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(opportunity_id, version)
);

create table if not exists public.website_crm_proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.website_crm_proposals(id) on delete cascade,
  catalog_item_id uuid references public.website_crm_catalog_items(id) on delete set null,
  name text not null,
  description text,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(14,2) not null default 0,
  discount_percent numeric(5,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  billing_model text not null default 'custom',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.website_crm_opportunity_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.website_crm_opportunities(id) on delete cascade,
  lead_id uuid references public.website_leads(id) on delete set null,
  event_type text not null,
  title text not null,
  detail text,
  before_state jsonb,
  after_state jsonb,
  actor text,
  created_at timestamptz not null default now()
);

create index if not exists website_crm_opportunities_lead_idx on public.website_crm_opportunities(lead_id, updated_at desc);
create index if not exists website_crm_opportunities_stage_idx on public.website_crm_opportunities(stage, expected_close_date);
create index if not exists website_crm_opportunity_contacts_idx on public.website_crm_opportunity_contacts(opportunity_id, is_primary desc);
create index if not exists website_crm_opportunity_items_idx on public.website_crm_opportunity_items(opportunity_id, created_at);
create index if not exists website_crm_proposals_opportunity_idx on public.website_crm_proposals(opportunity_id, version desc);
create index if not exists website_crm_opportunity_events_idx on public.website_crm_opportunity_events(opportunity_id, created_at desc);

alter table public.website_crm_opportunities enable row level security;
alter table public.website_crm_opportunity_contacts enable row level security;
alter table public.website_crm_catalog_items enable row level security;
alter table public.website_crm_opportunity_items enable row level security;
alter table public.website_crm_proposals enable row level security;
alter table public.website_crm_proposal_items enable row level security;
alter table public.website_crm_opportunity_events enable row level security;

insert into public.website_crm_catalog_items (sku, name, category, description, billing_model, currency, unit_price)
values
  ('MOONY-PRO-MONTH','MOONY Pro — mensuel','MOONY Pro','Abonnement professionnel mensuel.','monthly','XOF',15000),
  ('MOONY-PRO-QUARTER','MOONY Pro — trimestriel','MOONY Pro','Abonnement professionnel trimestriel.','quarterly','XOF',42000),
  ('MOONY-PRO-SEMIANNUAL','MOONY Pro — semestriel','MOONY Pro','Abonnement professionnel semestriel.','semiannual','XOF',75000),
  ('MOONY-PRO-ANNUAL','MOONY Pro — annuel','MOONY Pro','Abonnement professionnel annuel.','annual','XOF',150000),
  ('MOONY-ENTERPRISE-CUSTOM','MOONY Entreprise — sur mesure','MOONY Entreprise','Tarification sur mesure selon la taille et le périmètre de l’entreprise.','custom','XOF',null),
  ('MOONY-PARTNERSHIP-CUSTOM','Partenariat MOONY — sur mesure','Partenariat','Périmètre et valorisation à définir selon le partenariat.','custom','XOF',null)
on conflict (sku) do nothing;

insert into public.website_crm_opportunities (
  lead_id, legacy_key, name, stage, probability, amount, currency, owner, source, created_by, updated_by, created_at, updated_at
)
select
  lead.id,
  'lead:' || lead.id::text,
  coalesce(nullif(lead.company,''), trim(concat_ws(' ', lead.first_name, lead.last_name)), 'Opportunité') || ' — Opportunité',
  lead.status,
  case lead.status
    when 'new' then 0.05
    when 'to_contact' then 0.10
    when 'contacted' then 0.20
    when 'appointment' then 0.35
    when 'proposal' then 0.55
    when 'negotiation' then 0.75
    when 'won' then 1.00
    else 0.00
  end,
  coalesce(lead.deal_value,0),
  'XOF',
  lead.assigned_to,
  'legacy-lead-backfill',
  'MOONY Migration',
  'MOONY Migration',
  lead.created_at,
  lead.updated_at
from public.website_leads lead
where coalesce(lead.deal_value,0) > 0
on conflict (legacy_key) do nothing;

comment on table public.website_crm_opportunities is 'Advanced commercial opportunities linked to MOONY CRM leads.';
comment on table public.website_crm_proposals is 'Versioned commercial proposals and quote lifecycle for CRM opportunities.';
comment on table public.website_crm_opportunity_events is 'Complete audit-friendly lifecycle history for each commercial opportunity.';
