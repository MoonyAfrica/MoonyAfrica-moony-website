alter table public.website_crm_onboarding_cases
  add column if not exists client_portal_token_hash text,
  add column if not exists client_portal_enabled boolean not null default false,
  add column if not exists client_portal_issued_at timestamptz,
  add column if not exists client_portal_sent_at timestamptz,
  add column if not exists client_portal_email text,
  add column if not exists client_portal_first_viewed_at timestamptz,
  add column if not exists client_portal_last_viewed_at timestamptz,
  add column if not exists client_portal_view_count integer not null default 0 check (client_portal_view_count >= 0),
  add column if not exists client_profile jsonb not null default '{}'::jsonb,
  add column if not exists kickoff_response text not null default 'pending' check (kickoff_response in ('pending','confirmed','change_requested')),
  add column if not exists kickoff_response_at timestamptz,
  add column if not exists kickoff_response_name text,
  add column if not exists kickoff_response_message text;

alter table public.website_crm_onboarding_tasks
  add column if not exists client_visible boolean not null default false;

alter table public.website_crm_onboarding_documents
  add column if not exists client_visible boolean not null default true;

update public.website_crm_onboarding_tasks
set client_visible = true
where template_key in ('documents-collect','kickoff-schedule','implementation-plan','go-live-readiness');

create table if not exists public.website_crm_onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.website_crm_onboarding_cases(id) on delete cascade,
  document_id uuid not null references public.website_crm_onboarding_documents(id) on delete cascade,
  original_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 15728640),
  status text not null default 'received' check (status in ('received','validated','rejected')),
  submitted_by text,
  submitted_email text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists website_crm_onboarding_submissions_case_idx
  on public.website_crm_onboarding_submissions(onboarding_id, created_at desc);
create index if not exists website_crm_onboarding_submissions_document_idx
  on public.website_crm_onboarding_submissions(document_id, created_at desc);
create index if not exists website_crm_onboarding_portal_enabled_idx
  on public.website_crm_onboarding_cases(client_portal_enabled, client_portal_last_viewed_at desc);

alter table public.website_crm_onboarding_submissions enable row level security;
revoke all on public.website_crm_onboarding_submissions from anon, authenticated;
grant all on public.website_crm_onboarding_submissions to service_role;

comment on column public.website_crm_onboarding_cases.client_portal_token_hash is
  'SHA-256 hash only. The raw onboarding portal token is never stored.';
comment on column public.website_crm_onboarding_cases.client_profile is
  'Explicit organization, billing, signatory and operations information supplied by the client through the secure portal.';
comment on table public.website_crm_onboarding_submissions is
  'Private metadata for client onboarding uploads. File bytes live in the private onboarding-documents Storage bucket created server-side on first upload.';
