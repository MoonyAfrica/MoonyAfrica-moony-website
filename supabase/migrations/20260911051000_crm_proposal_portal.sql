alter table public.website_crm_proposals
  add column if not exists public_token_hash text,
  add column if not exists public_link_enabled boolean not null default false,
  add column if not exists public_token_issued_at timestamptz,
  add column if not exists sent_to_email text,
  add column if not exists first_viewed_at timestamptz,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists view_count integer not null default 0 check (view_count >= 0),
  add column if not exists responded_at timestamptz,
  add column if not exists response_name text,
  add column if not exists response_email text,
  add column if not exists response_message text,
  add column if not exists response_source text;

create index if not exists website_crm_proposals_public_link_idx
  on public.website_crm_proposals(public_link_enabled, valid_until, status);

comment on column public.website_crm_proposals.public_token_hash is
  'SHA-256 hash of the high-entropy client portal token. The raw token is never stored.';
comment on column public.website_crm_proposals.public_link_enabled is
  'Whether the secure client-facing proposal link is currently enabled.';
comment on column public.website_crm_proposals.first_viewed_at is
  'First verified client portal consultation timestamp.';
comment on column public.website_crm_proposals.last_viewed_at is
  'Most recent verified client portal consultation timestamp.';
comment on column public.website_crm_proposals.view_count is
  'Number of verified client portal consultations.';
comment on column public.website_crm_proposals.response_source is
  'Source of the proposal decision, for example client_portal or control_center.';