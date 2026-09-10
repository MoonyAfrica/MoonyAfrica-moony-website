create table if not exists public.website_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.website_pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  action text not null default 'save' check (action in ('create','save','publish','unpublish','archive','restore')),
  created_by text not null default 'MOONY Admin',
  note text,
  snapshot jsonb not null
);

create index if not exists website_page_versions_page_created_idx
  on public.website_page_versions (page_id, created_at desc);

alter table public.website_page_versions enable row level security;

insert into public.website_settings (key, value)
values
  ('navigation', '{"items":[{"label":"Accueil","href":"/","visible":true},{"label":"Notre mission","href":"/notre-mission","visible":true},{"label":"Notre approche","href":"/notre-approche","visible":true},{"label":"À propos","href":"/a-propos","visible":true},{"label":"Nos services","href":"/services","visible":true},{"label":"Communauté","href":"/communaute","visible":true},{"label":"Ressources","href":"/ressources","visible":true}],"primaryLabel":"Prendre rendez-vous","primaryHref":"/contact?objet=rendez-vous","secondaryLabel":"Se connecter","secondaryHref":"https://application.moony-africa.com"}'::jsonb),
  ('footer', '{"headline":"Pour la santé des femmes, à chaque étape de leur vie.","body":"Une expérience de santé féminine pensée pour être utile, rassurante et accessible, avec une ambition africaine et une ouverture sur le monde.","primaryLabel":"Accéder à l’application","primaryHref":"https://application.moony-africa.com","secondaryLabel":"Nous contacter","secondaryHref":"/contact","columns":[{"title":"Découvrir","links":[{"label":"Notre mission","href":"/notre-mission"},{"label":"Notre approche","href":"/notre-approche"},{"label":"Nos services","href":"/services"},{"label":"Communauté","href":"/communaute"},{"label":"Ressources","href":"/ressources"}]},{"title":"Confiance","links":[{"label":"Protection des données","href":"/confidentialite"},{"label":"Sécurité","href":"/confidentialite#securite"},{"label":"Service client","href":"/support"},{"label":"Méthode & qualité","href":"/notre-approche"},{"label":"Professionnels de santé","href":"/services#professionnels"}]},{"title":"Entreprise","links":[{"label":"À propos","href":"/a-propos"},{"label":"Partenariats","href":"/contact?objet=partenariat"},{"label":"Presse","href":"/presse"},{"label":"Carrières","href":"/carrieres"},{"label":"Nous contacter","href":"/contact"}]}],"instagramUrl":"","linkedinUrl":""}'::jsonb)
on conflict (key) do nothing;

comment on table public.website_page_versions is 'Immutable CMS page snapshots used by the MOONY Control Center for page history and rollback.';
