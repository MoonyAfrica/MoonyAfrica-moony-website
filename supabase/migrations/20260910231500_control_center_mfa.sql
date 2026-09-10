create table if not exists public.control_center_login_challenges (
  id uuid primary key,
  user_id uuid not null references public.control_center_users(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  consumed_at timestamptz
);

create index if not exists control_center_login_challenges_user_idx
  on public.control_center_login_challenges (user_id, created_at desc);

create index if not exists control_center_login_challenges_expiry_idx
  on public.control_center_login_challenges (expires_at)
  where consumed_at is null;

alter table public.control_center_login_challenges enable row level security;

comment on table public.control_center_login_challenges is
  'Short-lived hashed e-mail MFA challenges for MOONY Control Center team accounts. Accessed server-side with the service role only.';

-- Keep the table small when migrations are applied repeatedly in preview environments.
delete from public.control_center_login_challenges
where expires_at < now() - interval '24 hours';
