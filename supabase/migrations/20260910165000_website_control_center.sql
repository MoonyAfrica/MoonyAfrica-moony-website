create extension if not exists pgcrypto;

create table if not exists public.website_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  company text,
  role_title text,
  need text not null,
  message text,
  source text not null default 'website',
  status text not null default 'new' check (status in ('new','to_contact','contacted','appointment','proposal','negotiation','won','lost')),
  assigned_to text,
  deal_value numeric(14,2),
  country text,
  city text,
  notes text,
  last_contacted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists website_leads_created_at_idx on public.website_leads (created_at desc);
create index if not exists website_leads_status_idx on public.website_leads (status);
create index if not exists website_leads_email_idx on public.website_leads (lower(email));

create table if not exists public.website_appointments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid references public.website_leads(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  provider text,
  provider_event_id text,
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled','no_show')),
  meeting_url text,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  first_name text,
  locale text default 'fr',
  source text not null default 'website',
  status text not null default 'subscribed' check (status in ('subscribed','unsubscribed','bounced')),
  consent_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists newsletter_subscribers_email_idx on public.newsletter_subscribers (lower(email));

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  requester_name text,
  requester_email text not null,
  type text not null default 'question' check (type in ('question','request','incident','complaint','feedback')),
  subject text not null,
  message text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','waiting','resolved','closed')),
  assigned_to text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.website_testimonials (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author_name text not null,
  author_location text,
  author_role text,
  quote text not null,
  rating smallint check (rating between 1 and 5),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  featured boolean not null default false,
  consent_to_publish boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.website_partners (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  category text,
  website_url text,
  logo_url text,
  short_description text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.website_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.website_leads enable row level security;
alter table public.website_appointments enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.support_tickets enable row level security;
alter table public.website_testimonials enable row level security;
alter table public.website_partners enable row level security;
alter table public.website_settings enable row level security;

comment on table public.website_leads is 'Commercial leads created by the MOONY public website and managed in the Control Center.';
comment on table public.website_settings is 'Editable website and Control Center settings. Access is server-side until admin authentication policies are enabled.';
