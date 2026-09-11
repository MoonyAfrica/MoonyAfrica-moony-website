create table if not exists public.website_crm_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  color text not null default '#b9693d',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_lead_tags (
  lead_id uuid not null references public.website_leads(id) on delete cascade,
  tag_id uuid not null references public.website_crm_tags(id) on delete cascade,
  created_by text,
  created_at timestamptz not null default now(),
  primary key (lead_id, tag_id)
);

create table if not exists public.website_crm_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  filters jsonb not null default '{}'::jsonb,
  view_config jsonb not null default '{"view":"list","sort":"updated_desc"}'::jsonb,
  visibility text not null default 'team' check (visibility in ('team','private')),
  owner_user_key text,
  created_by text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_crm_lead_tags_tag_idx on public.website_crm_lead_tags(tag_id, lead_id);
create index if not exists website_crm_segments_owner_idx on public.website_crm_segments(owner_user_key, updated_at desc);
create index if not exists website_crm_segments_visibility_idx on public.website_crm_segments(visibility, is_pinned, updated_at desc);

alter table public.website_crm_tags enable row level security;
alter table public.website_crm_lead_tags enable row level security;
alter table public.website_crm_segments enable row level security;

comment on table public.website_crm_tags is 'Reusable commercial tags for CRM segmentation.';
comment on table public.website_crm_segments is 'Saved CRM filters and personalized commercial views.';
