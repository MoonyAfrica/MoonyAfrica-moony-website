create table if not exists public.website_crm_feedback_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.website_crm_client_accounts(id) on delete set null,
  source_type text not null default 'manual' check (source_type in ('manual','nps','support','testimonial')),
  source_id uuid,
  source_label text,
  contact_name text,
  contact_email text,
  source_score integer check (source_score is null or source_score between 0 and 10),
  feedback_kind text not null default 'other' check (feedback_kind in ('feature_request','bug','usability','service','praise','pricing','integration','other')),
  product_area text not null default 'other',
  themes text[] not null default '{}'::text[],
  title text not null,
  feedback_text text not null,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  importance integer not null default 3 check (importance between 1 and 5),
  status text not null default 'new' check (status in ('new','reviewed','planned','in_progress','closed','declined')),
  owner text,
  close_loop_due date,
  resolution_note text,
  reviewed_at timestamptz,
  reviewed_by text,
  closed_at timestamptz,
  closed_by text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists website_crm_feedback_source_unique_idx
  on public.website_crm_feedback_items(source_type, source_id)
  where source_id is not null;
create index if not exists website_crm_feedback_status_idx
  on public.website_crm_feedback_items(status, priority, updated_at desc);
create index if not exists website_crm_feedback_client_idx
  on public.website_crm_feedback_items(client_id, status, updated_at desc);
create index if not exists website_crm_feedback_product_idx
  on public.website_crm_feedback_items(product_area, status, updated_at desc);
create index if not exists website_crm_feedback_close_loop_idx
  on public.website_crm_feedback_items(status, close_loop_due)
  where close_loop_due is not null;
create index if not exists website_crm_feedback_themes_idx
  on public.website_crm_feedback_items using gin(themes);

create table if not exists public.website_crm_feedback_settings (
  id text primary key default 'default',
  enabled boolean not null default false,
  close_loop_warning_days integer not null default 3 check (close_loop_warning_days between 0 and 30),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.website_crm_feedback_settings (id) values ('default') on conflict (id) do nothing;

create table if not exists public.website_crm_feedback_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_key text not null unique,
  trigger_type text not null check (trigger_type in ('critical_feedback','close_loop_due')),
  feedback_id uuid references public.website_crm_feedback_items(id) on delete cascade,
  status text not null default 'success' check (status in ('success','skipped','failed')),
  summary text,
  created_at timestamptz not null default now()
);
create index if not exists website_crm_feedback_runs_created_idx on public.website_crm_feedback_runs(created_at desc);

alter table public.website_crm_feedback_items enable row level security;
alter table public.website_crm_feedback_settings enable row level security;
alter table public.website_crm_feedback_runs enable row level security;
revoke all on public.website_crm_feedback_items from anon, authenticated;
revoke all on public.website_crm_feedback_settings from anon, authenticated;
revoke all on public.website_crm_feedback_runs from anon, authenticated;
grant all on public.website_crm_feedback_items to service_role;
grant all on public.website_crm_feedback_settings to service_role;
grant all on public.website_crm_feedback_runs to service_role;

comment on table public.website_crm_feedback_items is
  'Explicit Voice of Customer records. Themes, product area, priority and importance are human-selected; no sentiment, influence or intent is inferred from health, browsing, demographic or sensitive user data.';
comment on column public.website_crm_feedback_items.source_id is
  'Optional explicit source record selected by a MOONY operator, such as an NPS response or support ticket. Sources are never promoted automatically.';
comment on column public.website_crm_feedback_items.feedback_text is
  'Feedback explicitly provided by a person or manually recorded by the MOONY team. It must not be synthesized from sensitive health or behavioral data.';
comment on table public.website_crm_feedback_settings is
  'Internal Voice of Customer alerts only. Disabled by default and never authorizes automatic client communication.';
comment on table public.website_crm_feedback_runs is
  'Idempotency history for internal critical-feedback and close-the-loop alerts.';
