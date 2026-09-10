create table if not exists public.website_pages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  seo_title text,
  seo_description text,
  hero jsonb not null default '{}'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists website_pages_status_idx on public.website_pages (status);
create index if not exists website_pages_updated_at_idx on public.website_pages (updated_at desc);

create table if not exists public.marketing_elements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  kind text not null check (kind in ('popup','banner','form','campaign')),
  status text not null default 'draft' check (status in ('draft','active','scheduled','paused','archived')),
  placement text[] not null default array['/']::text[],
  eyebrow text,
  headline text not null,
  body text,
  cta_label text,
  cta_url text,
  collect_email boolean not null default false,
  start_at timestamptz,
  end_at timestamptz,
  views bigint not null default 0,
  conversions bigint not null default 0,
  config jsonb not null default '{}'::jsonb
);

create index if not exists marketing_elements_status_idx on public.marketing_elements (status);
create index if not exists marketing_elements_kind_idx on public.marketing_elements (kind);

create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  subject text not null,
  preheader text,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','paused','cancelled')),
  audience text not null default 'all',
  sender_name text not null default 'MOONY Africa',
  sender_email text,
  content jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  sent_at timestamptz,
  provider text,
  provider_campaign_id text,
  stats jsonb not null default '{}'::jsonb
);

create index if not exists newsletter_campaigns_status_idx on public.newsletter_campaigns (status);
create index if not exists newsletter_campaigns_created_at_idx on public.newsletter_campaigns (created_at desc);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_kind text not null check (sender_kind in ('requester','agent','system')),
  sender_name text,
  body text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists support_ticket_messages_ticket_idx on public.support_ticket_messages (ticket_id, created_at asc);

alter table public.website_pages enable row level security;
alter table public.marketing_elements enable row level security;
alter table public.newsletter_campaigns enable row level security;
alter table public.support_ticket_messages enable row level security;

insert into public.website_pages (title, slug, status, hero)
values
  ('Accueil', '/', 'published', '{"title":"Ancrée dans nos cultures, tournée vers l’avenir.","body":"Une expérience de santé féminine qui réunit transmission, communauté, bien-être et innovation à chaque étape de la vie.","primaryLabel":"Découvrir la communauté","primaryHref":"/communaute","secondaryLabel":"Nos services","secondaryHref":"/services"}'::jsonb),
  ('Notre mission', '/notre-mission', 'published', '{"title":"Notre mission\nRendre la santé féminine plus accessible, plus humaine et plus enracinée dans les réalités des femmes africaines.","body":"De la puberté à la maternité, du post-partum au bien-être quotidien, MOONY informe, accompagne et relie les femmes à des ressources fiables, des professionnelles de santé et une communauté bienveillante.","primaryLabel":"Découvrir notre approche","primaryHref":"/notre-approche","secondaryLabel":"Voir nos services","secondaryHref":"/services"}'::jsonb),
  ('Notre approche', '/notre-approche', 'published', '{"title":"Écouter,\norienter,\naccompagner.","body":"MOONY relie information fiable, communauté bienveillante et accès à des professionnelles pour accompagner les femmes à chaque étape de leur vie.","primaryLabel":"Voir nos services","primaryHref":"/services","secondaryLabel":"Découvrir la communauté","secondaryHref":"/communaute"}'::jsonb),
  ('À propos', '/a-propos', 'published', '{"eyebrow":"À propos","title":"Une histoire de soin,\nde transmission\net d’horizons.","body":"MOONY est née du désir d’offrir aux femmes un espace de santé plus proche, plus doux et plus enraciné dans leurs réalités. Pensée pour l’Afrique et ouverte sur le monde, la plateforme réunit information fiable, accompagnement, communauté et innovation à chaque étape de la vie.","primaryLabel":"Découvrir notre mission","primaryHref":"/notre-mission","secondaryLabel":"Voir notre approche","secondaryHref":"/notre-approche"}'::jsonb),
  ('Nos services', '/services', 'published', '{}'::jsonb),
  ('Communauté', '/communaute', 'published', '{}'::jsonb),
  ('Ressources', '/ressources', 'published', '{}'::jsonb),
  ('Nous contacter', '/contact', 'published', '{}'::jsonb),
  ('Mentions légales', '/mentions-legales', 'published', '{}'::jsonb)
on conflict (slug) do nothing;

comment on table public.website_pages is 'Editable public website pages managed from MOONY Control Center.';
comment on table public.marketing_elements is 'Popups, banners, forms and campaigns rendered by the public website.';
comment on table public.newsletter_campaigns is 'Newsletter drafts, schedules and provider delivery metadata.';
comment on table public.support_ticket_messages is 'Conversation history for Control Center support tickets.';
