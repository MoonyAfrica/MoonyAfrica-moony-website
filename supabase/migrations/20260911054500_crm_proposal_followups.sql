alter table public.website_crm_proposals
  add column if not exists last_reminder_at timestamptz,
  add column if not exists reminder_count integer not null default 0 check (reminder_count >= 0),
  add column if not exists viewed_followup_sent_at timestamptz,
  add column if not exists expiry_reminder_sent_at timestamptz,
  add column if not exists expired_at timestamptz;

create table if not exists public.website_crm_proposal_followup_settings (
  id text primary key default 'default',
  auto_reminders boolean not null default false,
  viewed_followup_hours integer not null default 48 check (viewed_followup_hours between 1 and 720),
  expiry_reminder_hours integer not null default 48 check (expiry_reminder_hours between 1 and 720),
  max_reminders integer not null default 2 check (max_reminders between 0 and 10),
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.website_crm_proposal_followup_settings enable row level security;

insert into public.website_crm_proposal_followup_settings (
  id, auto_reminders, viewed_followup_hours, expiry_reminder_hours, max_reminders
)
values ('default', false, 48, 48, 2)
on conflict (id) do nothing;

create index if not exists website_crm_proposals_followup_idx
  on public.website_crm_proposals(status, valid_until, last_viewed_at, last_reminder_at);

comment on table public.website_crm_proposal_followup_settings is
  'Control Center settings for automatic proposal reminders. Auto reminders are disabled by default.';
comment on column public.website_crm_proposals.viewed_followup_sent_at is
  'Timestamp of the automatic follow-up sent after a client viewed but did not answer.';
comment on column public.website_crm_proposals.expiry_reminder_sent_at is
  'Timestamp of the automatic reminder sent before proposal expiry.';