create table if not exists public.website_crm_scoring_settings (
  id text primary key default 'default' check (id = 'default'),
  stage_points jsonb not null default '{"new":8,"to_contact":12,"contacted":25,"appointment":40,"proposal":50,"negotiation":60,"won":100,"lost":0}'::jsonb,
  hot_threshold integer not null default 70 check (hot_threshold between 1 and 100),
  warm_threshold integer not null default 40 check (warm_threshold between 0 and 99),
  high_value_threshold numeric not null default 10000 check (high_value_threshold >= 0),
  stale_after_days integer not null default 14 check (stale_after_days between 1 and 90),
  tag_bonus_enabled boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now(),
  check (warm_threshold < hot_threshold)
);

insert into public.website_crm_scoring_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.website_crm_scoring_settings enable row level security;

comment on table public.website_crm_scoring_settings is
  'Transparent commercial lead scoring configuration for the MOONY Control Center. Scores use only explicit CRM/business data and never infer health, gender or other sensitive traits.';
