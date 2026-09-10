create extension if not exists pgcrypto;

create table if not exists public.control_center_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.control_center_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  password_hash text not null,
  role_id uuid not null references public.control_center_roles(id) on delete restrict,
  active boolean not null default true,
  last_login_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists control_center_users_email_idx on public.control_center_users (lower(email));
create index if not exists control_center_users_role_idx on public.control_center_users (role_id);

create table if not exists public.control_center_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid references public.control_center_users(id) on delete set null,
  actor_email text,
  actor_name text,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists control_center_audit_created_idx on public.control_center_audit_logs (created_at desc);
create index if not exists control_center_audit_actor_idx on public.control_center_audit_logs (actor_user_id, created_at desc);
create index if not exists control_center_audit_entity_idx on public.control_center_audit_logs (entity_type, entity_id, created_at desc);

insert into public.control_center_roles (key,name,description,permissions)
values
  ('founder','Founder / Super Admin','Accès complet au Control Center.','["*"]'::jsonb),
  ('admin','Administrateur','Gestion générale du site, du contenu, du CRM et du marketing.','["site.read","site.write","content.read","content.write","crm.read","crm.write","appointments.read","appointments.write","marketing.read","marketing.write","support.read","support.write","analytics.read","seo.read","seo.write","settings.read","settings.write","audit.read"]'::jsonb),
  ('sales','Commercial','Prospects, opportunités, rendez-vous et suivi commercial.','["crm.read","crm.write","appointments.read","appointments.write","analytics.read"]'::jsonb),
  ('marketing','Marketing','Campagnes, newsletters, pop-ups, contenus et performance.','["marketing.read","marketing.write","content.read","content.write","analytics.read","seo.read"]'::jsonb),
  ('content','Contenu','Pages, articles, ressources, médias et SEO éditorial.','["site.read","site.write","content.read","content.write","seo.read","seo.write"]'::jsonb),
  ('support','Support','Tickets, conversations et rendez-vous de support.','["support.read","support.write","appointments.read"]'::jsonb),
  ('analytics','Lecture analytique','Accès en lecture aux données de performance.','["analytics.read","crm.read","marketing.read","content.read"]'::jsonb)
on conflict (key) do update set
  name=excluded.name,
  description=excluded.description,
  permissions=excluded.permissions,
  updated_at=now();

alter table public.control_center_roles enable row level security;
alter table public.control_center_users enable row level security;
alter table public.control_center_audit_logs enable row level security;

comment on table public.control_center_users is 'Application-level users for the MOONY website Control Center. Password hashes are server-side only.';
comment on table public.control_center_audit_logs is 'Immutable-style operational audit trail for sensitive Control Center actions.';
