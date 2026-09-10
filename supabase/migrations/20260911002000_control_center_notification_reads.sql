create table if not exists public.control_center_notification_reads (
  user_key text not null,
  notification_key text not null,
  read_at timestamptz null,
  dismissed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_key, notification_key)
);

create index if not exists control_center_notification_reads_user_updated_idx
  on public.control_center_notification_reads (user_key, updated_at desc);

alter table public.control_center_notification_reads enable row level security;

revoke all on public.control_center_notification_reads from public, anon, authenticated;
grant all on public.control_center_notification_reads to service_role;

comment on table public.control_center_notification_reads is
  'Per-Control-Center-user read/dismiss state for generated operational notifications.';
