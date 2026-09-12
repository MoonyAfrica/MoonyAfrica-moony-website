create table if not exists public.website_crm_executive_reports (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique,
  title text not null,
  status text not null default 'draft' check (status in ('draft','final')),
  metrics jsonb not null default '{}'::jsonb,
  data_quality jsonb not null default '{}'::jsonb,
  highlights text,
  risks text,
  priorities text,
  decisions text,
  captured_at timestamptz not null default now(),
  captured_by text,
  finalized_at timestamptz,
  finalized_by text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_trunc('month', period_month::timestamp)::date = period_month),
  check ((status = 'draft' and finalized_at is null and finalized_by is null) or status = 'final')
);

create index if not exists website_crm_executive_reports_period_idx
  on public.website_crm_executive_reports(period_month desc);
create index if not exists website_crm_executive_reports_status_idx
  on public.website_crm_executive_reports(status, period_month desc);

alter table public.website_crm_executive_reports enable row level security;
revoke all on public.website_crm_executive_reports from anon, authenticated;
grant all on public.website_crm_executive_reports to service_role;

comment on table public.website_crm_executive_reports is
  'Frozen monthly executive and investor board packs. Numeric metrics are captured from explicit CRM operational data; executive narrative is written by a human operator.';
comment on column public.website_crm_executive_reports.metrics is
  'Snapshot payload captured for the period. Currencies remain separate; this payload must never invent a cross-currency total without an explicit dated FX source.';
comment on column public.website_crm_executive_reports.data_quality is
  'Explicit capture-time availability and exclusions. Missing source modules are surfaced instead of silently estimating metrics.';
comment on column public.website_crm_executive_reports.highlights is
  'Human-authored executive commentary. It is not generated from sensitive health, demographic or behavioral inference.';
comment on column public.website_crm_executive_reports.risks is
  'Human-authored risk commentary. Final reports are locked by the application and are not silently recaptured.';
