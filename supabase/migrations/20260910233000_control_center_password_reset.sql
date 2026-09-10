create table if not exists public.control_center_password_resets (
  id uuid primary key,
  user_id uuid not null references public.control_center_users(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists control_center_password_resets_user_idx
  on public.control_center_password_resets (user_id, created_at desc);

create index if not exists control_center_password_resets_expiry_idx
  on public.control_center_password_resets (expires_at)
  where consumed_at is null;

alter table public.control_center_password_resets enable row level security;

comment on table public.control_center_password_resets is
  'Short-lived one-time password reset links for MOONY Control Center team accounts. Accessed server-side with the service role only.';

delete from public.control_center_password_resets
where expires_at < now() - interval '24 hours';
