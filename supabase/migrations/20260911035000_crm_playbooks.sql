create table if not exists public.website_crm_playbooks (
  id uuid primary key default gen_random_uuid(),
  system_key text unique,
  name text not null,
  description text,
  active boolean not null default true,
  priority integer not null default 100 check (priority between 1 and 1000),
  conditions jsonb not null default '{}'::jsonb,
  guidance jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_playbook_runs (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid references public.website_crm_playbooks(id) on delete set null,
  lead_id uuid not null references public.website_leads(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied','completed','dismissed')),
  applied_by text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists website_crm_playbooks_active_idx on public.website_crm_playbooks(active, priority, updated_at desc);
create index if not exists website_crm_playbook_runs_lead_idx on public.website_crm_playbook_runs(lead_id, created_at desc);
create index if not exists website_crm_playbook_runs_playbook_idx on public.website_crm_playbook_runs(playbook_id, created_at desc);

alter table public.website_crm_playbooks enable row level security;
alter table public.website_crm_playbook_runs enable row level security;

insert into public.website_crm_playbooks (system_key, name, description, priority, conditions, guidance, created_by, updated_by)
values
(
  'hot-priority',
  'Prospect chaud — traitement prioritaire',
  'Pour les opportunités à fort score qui doivent recevoir un suivi humain rapide et structuré.',
  10,
  '{"temperatures":["hot"],"statuses":["new","to_contact","contacted","appointment","proposal","negotiation"],"min_score":70}'::jsonb,
  '{"objective":"Transformer l’intérêt élevé en prochaine étape concrète sans rallonger le cycle.","next_action":"Contacter personnellement le prospect et obtenir une prochaine étape datée.","due_in_hours":4,"task_priority":"urgent","channel":"call","argument_points":["Reformuler le besoin métier avant de présenter la solution.","Relier la proposition MOONY à un résultat concret pour l’organisation.","Terminer l’échange avec une date, un responsable et une prochaine action."],"message_template":"Bonjour {{first_name}},\n\nMerci pour votre intérêt pour MOONY. J’aimerais reprendre avec vous votre besoin autour de {{need}} et voir quelle prochaine étape serait la plus utile pour {{company}}.\n\nÊtes-vous disponible pour un échange court cette semaine ?\n\nBien à vous,\nL’équipe MOONY"}'::jsonb,
  'MOONY System',
  'MOONY System'
),
(
  'partnership',
  'Partenariat — qualification & valeur mutuelle',
  'Cadre de suivi pour les demandes de partenariat, institutionnelles ou écosystème.',
  20,
  '{"needs":["partenariat"],"statuses":["new","to_contact","contacted","appointment","proposal","negotiation"]}'::jsonb,
  '{"objective":"Qualifier le partenariat et faire émerger une proposition de valeur mutuelle.","next_action":"Organiser un échange de qualification partenariat.","due_in_hours":24,"task_priority":"high","channel":"email","argument_points":["Clarifier l’objectif du partenaire et la population concernée.","Identifier ce que chaque partie apporte : audience, expertise, distribution, visibilité ou terrain.","Définir un pilote simple avec indicateurs de succès et calendrier."],"message_template":"Bonjour {{first_name}},\n\nMerci pour votre message concernant un partenariat avec MOONY. Nous serions ravies de mieux comprendre vos objectifs, vos publics prioritaires et la forme de collaboration que vous imaginez.\n\nJe vous propose un échange de 30 minutes afin d’identifier un format de partenariat pertinent pour nos deux organisations.\n\nBien à vous,\nL’équipe MOONY"}'::jsonb,
  'MOONY System',
  'MOONY System'
),
(
  'enterprise',
  'Entreprise — découverte & déploiement',
  'Playbook pour les demandes B2B entreprise autour du programme MOONY Entreprise.',
  30,
  '{"needs":["entreprise"],"statuses":["new","to_contact","contacted","appointment","proposal","negotiation"]}'::jsonb,
  '{"objective":"Qualifier le contexte RH et construire un déploiement proportionné à la taille de l’entreprise.","next_action":"Qualifier effectif, enjeux RH, interlocuteurs et calendrier de décision.","due_in_hours":24,"task_priority":"high","channel":"call","argument_points":["Comprendre l’effectif, les sites, les populations concernées et les enjeux RH prioritaires.","Présenter MOONY comme un dispositif d’accès et d’accompagnement, sans exposer de données de santé aux RH.","Proposer un périmètre pilote et une tarification sur mesure avant généralisation."],"message_template":"Bonjour {{first_name}},\n\nMerci pour votre intérêt pour MOONY Entreprise. Pour vous proposer un dispositif adapté, j’aimerais mieux comprendre votre effectif, vos priorités RH et le périmètre envisagé.\n\nJe vous propose un court échange de cadrage afin de préparer une recommandation sur mesure.\n\nBien à vous,\nL’équipe MOONY"}'::jsonb,
  'MOONY System',
  'MOONY System'
),
(
  'demo',
  'Démonstration — préparer la conversion',
  'Cadre de préparation et de suivi pour une demande de démonstration produit.',
  40,
  '{"needs":["demonstration"],"statuses":["new","to_contact","contacted","appointment"]}'::jsonb,
  '{"objective":"Transformer la demande de démonstration en échange contextualisé puis en prochaine étape commerciale.","next_action":"Confirmer le contexte, préparer une démonstration ciblée et convenir du critère de succès.","due_in_hours":12,"task_priority":"high","channel":"email","argument_points":["Demander le rôle de l’interlocuteur et le problème qu’il souhaite résoudre.","Ne montrer que les parcours utiles au contexte exprimé.","Conclure la démonstration par une prochaine étape et un calendrier."],"message_template":"Bonjour {{first_name}},\n\nMerci pour votre demande de démonstration de MOONY. Afin de préparer une session vraiment utile, pourriez-vous me préciser votre contexte et les sujets que vous souhaitez voir en priorité ?\n\nNous pourrons ensuite convenir du meilleur créneau.\n\nBien à vous,\nL’équipe MOONY"}'::jsonb,
  'MOONY System',
  'MOONY System'
),
(
  'stale-reengagement',
  'Réengagement — opportunité sans suivi',
  'Relance humaine courte lorsqu’une opportunité active n’a pas été suivie depuis plusieurs jours.',
  60,
  '{"statuses":["to_contact","contacted","appointment","proposal","negotiation"],"stale_min_days":14}'::jsonb,
  '{"objective":"Réouvrir la conversation sans pression et vérifier si le timing ou la priorité a changé.","next_action":"Envoyer une relance courte, puis décider de maintenir ou de sortir l’opportunité du pipeline.","due_in_hours":4,"task_priority":"normal","channel":"email","argument_points":["Rappeler le contexte en une phrase.","Poser une question simple sur le timing ou la priorité actuelle.","Éviter les relances répétitives : proposer une clôture propre si le sujet n’est plus prioritaire."],"message_template":"Bonjour {{first_name}},\n\nJe reviens vers vous concernant notre échange autour de {{need}}. Est-ce toujours un sujet d’actualité pour {{company}} ou préférez-vous que nous reprenions à un autre moment ?\n\nBien à vous,\nL’équipe MOONY"}'::jsonb,
  'MOONY System',
  'MOONY System'
)
on conflict (system_key) do nothing;

comment on table public.website_crm_playbooks is
  'Human-review commercial playbooks matched from explicit CRM signals such as stage, need, score and follow-up recency.';
comment on table public.website_crm_playbook_runs is
  'Audit-friendly record of playbooks explicitly applied to CRM leads by Control Center users.';
