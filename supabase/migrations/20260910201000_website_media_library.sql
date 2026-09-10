insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website-media',
  'website-media',
  true,
  15728640,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.website_media (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  file_name text not null,
  storage_path text not null unique,
  public_url text not null,
  mime_type text,
  file_size bigint,
  alt_text text,
  folder text not null default 'general',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists website_media_created_at_idx on public.website_media (created_at desc);
create index if not exists website_media_folder_idx on public.website_media (folder);
alter table public.website_media enable row level security;

comment on table public.website_media is 'Public website media managed through the authenticated MOONY Control Center; uploads and mutations are server-side only.';
