create table if not exists public.website_crm_forecast_settings (
  id text primary key default 'default' check (id = 'default'),
  stage_probabilities jsonb not null default '{"new":0.05,"to_contact":0.10,"contacted":0.20,"appointment":0.35,"proposal":0.55,"negotiation":0.75,"won":1.0,"lost":0.0}'::jsonb,
  monthly_target numeric,
  currency text not null default 'EUR',
  stale_after_days integer not null default 7 check (stale_after_days between 1 and 90),
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into public.website_crm_forecast_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.website_crm_forecast_settings enable row level security;

comment on table public.website_crm_forecast_settings is
  'Control Center sales forecast settings: stage probabilities, commercial target and stale-deal threshold.';
