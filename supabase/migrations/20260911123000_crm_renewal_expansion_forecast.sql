alter table public.website_crm_client_growth_opportunities
  add column if not exists owner text,
  add column if not exists forecast_category text not null default 'pipeline' check (forecast_category in ('pipeline','best_case','commit','closed')),
  add column if not exists forecast_probability integer check (forecast_probability is null or forecast_probability between 0 and 100),
  add column if not exists next_step text,
  add column if not exists expected_close_date date,
  add column if not exists forecast_notes text,
  add column if not exists source text not null default 'manual' check (source in ('manual','retention','customer_success')),
  add column if not exists last_forecast_at timestamptz,
  add column if not exists last_forecast_by text;

update public.website_crm_client_growth_opportunities
set expected_close_date = coalesce(expected_close_date, due_date),
    source = case when created_by = 'MOONY Retention' then 'retention' else source end,
    forecast_category = case when status in ('won','lost','dismissed') then 'closed' else forecast_category end,
    forecast_probability = case
      when status = 'won' then 100
      when status in ('lost','dismissed') then 0
      else forecast_probability
    end
where expected_close_date is null
   or created_by = 'MOONY Retention'
   or status in ('won','lost','dismissed');

create table if not exists public.website_crm_revenue_forecast_settings (
  id text primary key default 'default',
  enabled boolean not null default false,
  attention_days integer not null default 45 check (attention_days between 1 and 365),
  stale_after_days integer not null default 14 check (stale_after_days between 1 and 90),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.website_crm_revenue_forecast_settings (id)
values ('default')
on conflict (id) do nothing;

create index if not exists website_crm_growth_forecast_idx
  on public.website_crm_client_growth_opportunities(status, forecast_category, expected_close_date, owner);
create index if not exists website_crm_growth_kind_forecast_idx
  on public.website_crm_client_growth_opportunities(kind, status, expected_close_date);
create index if not exists website_crm_growth_forecast_stale_idx
  on public.website_crm_client_growth_opportunities(status, last_forecast_at);

alter table public.website_crm_revenue_forecast_settings enable row level security;
revoke all on public.website_crm_revenue_forecast_settings from anon, authenticated;
grant all on public.website_crm_revenue_forecast_settings to service_role;

comment on column public.website_crm_client_growth_opportunities.forecast_category is
  'Human-selected Customer Success forecast category. Pipeline, best case and commit are never inferred automatically from sensitive client data.';
comment on column public.website_crm_client_growth_opportunities.forecast_probability is
  'Explicit forecast probability entered by the MOONY team. Null means no probability has been validated yet.';
comment on column public.website_crm_client_growth_opportunities.source is
  'Operational origin of the renewal or expansion record: manual, retention automation or Customer Success.';
comment on table public.website_crm_revenue_forecast_settings is
  'Human-controlled internal alert settings for the post-signature renewal and expansion forecast. Automated client communications are never triggered from these settings.';
