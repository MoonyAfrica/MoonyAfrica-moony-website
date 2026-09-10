create table if not exists public.website_resources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  slug text not null unique,
  resource_type text not null default 'guide' check (resource_type in ('guide','fiche','outil','video','webinaire','autre')),
  category text not null,
  excerpt text,
  content text,
  image_url text,
  file_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  featured boolean not null default false,
  downloads bigint not null default 0,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists website_resources_status_idx on public.website_resources(status);
create index if not exists website_resources_category_idx on public.website_resources(category);
create index if not exists website_resources_updated_idx on public.website_resources(updated_at desc);

create table if not exists public.website_articles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  slug text not null unique,
  category text not null,
  excerpt text,
  content text not null default '',
  image_url text,
  status text not null default 'draft' check (status in ('draft','review','scheduled','published','archived')),
  featured boolean not null default false,
  scheduled_at timestamptz,
  published_at timestamptz,
  seo_title text,
  seo_description text,
  author_name text not null default 'MOONY Africa',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists website_articles_status_idx on public.website_articles(status);
create index if not exists website_articles_category_idx on public.website_articles(category);
create index if not exists website_articles_published_idx on public.website_articles(published_at desc nulls last);

create table if not exists public.website_analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_name text not null,
  path text,
  session_id text,
  visitor_id text,
  country text,
  city text,
  device text,
  source text,
  referrer text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists website_analytics_events_created_idx on public.website_analytics_events(created_at desc);
create index if not exists website_analytics_events_name_idx on public.website_analytics_events(event_name);
create index if not exists website_analytics_events_path_idx on public.website_analytics_events(path);

alter table public.website_resources enable row level security;
alter table public.website_articles enable row level security;
alter table public.website_analytics_events enable row level security;

alter table public.website_testimonials add column if not exists updated_at timestamptz not null default now();
alter table public.website_partners add column if not exists updated_at timestamptz not null default now();
alter table public.website_partners add column if not exists country text;
alter table public.website_partners add column if not exists featured boolean not null default false;

insert into public.website_resources (title, slug, resource_type, category, excerpt, status, featured, downloads, sort_order)
values
  ('Guide Grossesse Sereine','guide-grossesse-sereine','guide','Grossesse & post-partum','Des repères simples pour préparer chaque étape avec plus de sérénité.','published',true,1240,10),
  ('Fiche Allaitement','fiche-allaitement','fiche','Santé féminine','Une fiche pratique pour comprendre les bases de l’allaitement.','published',false,982,20),
  ('Checklist Valise Maternité','checklist-valise-maternite','outil','Grossesse & post-partum','Une checklist claire pour préparer l’arrivée de bébé.','published',false,756,30),
  ('Guide Post-partum','guide-post-partum','guide','Grossesse & post-partum','Anticiper les premières semaines après l’accouchement.','published',true,1102,40),
  ('Fiche Alimentation','fiche-alimentation','fiche','Nutrition & mode de vie','Des bases simples pour une alimentation plus équilibrée.','draft',false,643,50)
on conflict (slug) do nothing;

insert into public.website_articles (title, slug, category, excerpt, content, status, featured, published_at, seo_title, seo_description)
values
  ('Santé des femmes : ensemble pour demain','sante-des-femmes-ensemble-pour-demain','Santé féminine','Pourquoi une approche globale de la santé féminine change les trajectoires.','La santé des femmes est un enjeu essentiel pour construire des sociétés plus justes et plus fortes. Chez MOONY, nous croyons en un accompagnement global, bienveillant et accessible à toutes.','published',true,now(),'Santé des femmes : ensemble pour demain | MOONY','Une approche accessible, humaine et ancrée dans les réalités des femmes.'),
  ('Rituels bien-être au quotidien','rituels-bien-etre-au-quotidien','Santé mentale','Des gestes simples pour prendre soin de soi chaque jour.','Le bien-être se construit souvent avec de petites habitudes réalistes, répétées et adaptées à son quotidien.','draft',false,null,null,null),
  ('L’alimentation pendant la grossesse','alimentation-pendant-la-grossesse','Grossesse & post-partum','Des repères généraux pour mieux comprendre les besoins pendant la grossesse.','Pendant la grossesse, les besoins évoluent. Une information fiable aide à faire des choix adaptés avec les professionnels de santé qui vous accompagnent.','scheduled',false,now() + interval '7 days',null,null),
  ('Témoignage : mon parcours','temoignage-mon-parcours','Histoires de femmes','Un récit de parcours, de doutes et de reconstruction.','Chaque parcours est unique. Partager certaines expériences peut permettre à d’autres femmes de se sentir moins seules.','published',false,now() - interval '10 days',null,null)
on conflict (slug) do nothing;

comment on table public.website_resources is 'Guides, fiches, tools and downloadable resources managed from MOONY Control Center.';
comment on table public.website_articles is 'Editorial journal content managed from MOONY Control Center.';
comment on table public.website_analytics_events is 'Privacy-first first-party website events; no sensitive inference is stored.';
