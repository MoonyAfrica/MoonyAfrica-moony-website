create table if not exists public.website_crm_product_releases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text,
  status text not null default 'draft' check (status in ('draft','planned','in_progress','released','cancelled')),
  planned_date date,
  released_at timestamptz,
  owner text,
  summary text,
  release_notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_product_initiatives (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  title text not null,
  problem_statement text,
  product_area text not null default 'other',
  themes text[] not null default '{}',
  status text not null default 'idea' check (status in ('idea','discovery','planned','in_progress','released','declined')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  impact smallint not null default 3 check (impact between 1 and 5),
  confidence smallint not null default 3 check (confidence between 1 and 5),
  effort smallint not null default 3 check (effort between 1 and 5),
  owner text,
  target_release_id uuid references public.website_crm_product_releases(id) on delete set null,
  target_date date,
  decision_rationale text,
  success_metric text,
  expected_outcome text,
  release_notes text,
  released_at timestamptz,
  released_by text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_product_initiative_feedback (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.website_crm_product_initiatives(id) on delete cascade,
  feedback_id uuid not null references public.website_crm_feedback_items(id) on delete cascade,
  note text,
  linked_by text,
  linked_at timestamptz not null default now(),
  unique (initiative_id, feedback_id)
);

create index if not exists website_crm_product_initiatives_status_idx on public.website_crm_product_initiatives(status, priority, updated_at desc);
create index if not exists website_crm_product_initiatives_release_idx on public.website_crm_product_initiatives(target_release_id, status);
create index if not exists website_crm_product_initiatives_themes_idx on public.website_crm_product_initiatives using gin(themes);
create index if not exists website_crm_product_releases_status_idx on public.website_crm_product_releases(status, planned_date);
create index if not exists website_crm_product_initiative_feedback_feedback_idx on public.website_crm_product_initiative_feedback(feedback_id);

alter table public.website_crm_product_releases enable row level security;
alter table public.website_crm_product_initiatives enable row level security;
alter table public.website_crm_product_initiative_feedback enable row level security;
revoke all on public.website_crm_product_releases from anon, authenticated;
revoke all on public.website_crm_product_initiatives from anon, authenticated;
revoke all on public.website_crm_product_initiative_feedback from anon, authenticated;
grant all on public.website_crm_product_releases to service_role;
grant all on public.website_crm_product_initiatives to service_role;
grant all on public.website_crm_product_initiative_feedback to service_role;

comment on table public.website_crm_product_initiatives is 'Human-managed product roadmap. Priority, impact, confidence and effort are explicit operator inputs, never inferred from sensitive customer data.';
comment on table public.website_crm_product_initiative_feedback is 'Explicit links between Voice of Customer feedback and product initiatives. No feedback is linked automatically.';
comment on table public.website_crm_product_releases is 'Human-managed product releases. Release actions do not automatically message customers or publish externally.';
