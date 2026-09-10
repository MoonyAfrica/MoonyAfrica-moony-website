alter table public.control_center_users
  add column if not exists must_change_password boolean not null default false;

create table if not exists public.control_center_sessions (
  id uuid primary key,
  user_id uuid not null references public.control_center_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  device_label text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists control_center_sessions_user_idx
  on public.control_center_sessions (user_id, created_at desc);

create index if not exists control_center_sessions_active_idx
  on public.control_center_sessions (expires_at)
  where revoked_at is null;

alter table public.control_center_sessions enable row level security;

comment on table public.control_center_sessions is
  'Server-validated, revocable sessions for the MOONY Control Center. No raw IP address is stored.';
comment on column public.control_center_users.must_change_password is
  'When true, the member can only access account security until a new personal password is chosen.';

delete from public.control_center_sessions
where expires_at < now() - interval '7 days'
   or revoked_at < now() - interval '7 days';
