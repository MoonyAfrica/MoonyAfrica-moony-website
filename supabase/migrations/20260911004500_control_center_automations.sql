create table if not exists public.control_center_automation_rules (
  id uuid primary key default gen_random_uuid(),
  template_key text unique,
  name text not null,
  description text,
  trigger_type text not null check (trigger_type in ('new_lead','urgent_ticket','appointment_reminder','stale_lead')),
  enabled boolean not null default false,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  created_by text,
  last_run_at timestamptz,
  run_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.control_center_automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.control_center_automation_rules(id) on delete cascade,
  event_key text not null,
  source_type text,
  source_id text,
  status text not null default 'running' check (status in ('running','success','failed','skipped')),
  result jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(rule_id, event_key)
);

create table if not exists public.control_center_generated_notifications (
  id uuid primary key default gen_random_uuid(),
  automation_rule_id uuid references public.control_center_automation_rules(id) on delete set null,
  target_role text,
  target_user_key text,
  title text not null,
  subtitle text,
  href text not null default '/admin/activite',
  severity text not null default 'info' check (severity in ('info','warning','urgent')),
  source_type text,
  source_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists control_center_automation_rules_enabled_idx on public.control_center_automation_rules(enabled, trigger_type);
create index if not exists control_center_automation_runs_rule_idx on public.control_center_automation_runs(rule_id, started_at desc);
create index if not exists control_center_generated_notifications_target_idx on public.control_center_generated_notifications(target_role, target_user_key, created_at desc);

alter table public.control_center_automation_rules enable row level security;
alter table public.control_center_automation_runs enable row level security;
alter table public.control_center_generated_notifications enable row level security;

insert into public.control_center_automation_rules (template_key,name,description,trigger_type,enabled,conditions,actions)
values
  ('lead-first-followup','Nouveau lead → première relance','Crée automatiquement une tâche commerciale lorsqu’un nouveau prospect entre dans le CRM.','new_lead',false,'{"statuses":["new","to_contact"]}'::jsonb,'[{"type":"create_crm_task","title":"Contacter {{lead}}","due_in_hours":24,"priority":"high"},{"type":"notify_role","role":"sales","title":"Nouveau prospect à contacter","subtitle":"{{lead}} vient d’entrer dans le CRM.","href":"/admin/crm?lead={{lead_id}}","severity":"info"}]'::jsonb),
  ('urgent-support-alert','Ticket urgent → alerte Support','Alerte immédiatement l’équipe Support lorsqu’un ticket passe en priorité urgente.','urgent_ticket',false,'{"priorities":["urgent"]}'::jsonb,'[{"type":"notify_role","role":"support","title":"Ticket support urgent","subtitle":"{{subject}} · {{requester}}","href":"/admin/service-client?ticket={{ticket_id}}","severity":"urgent"}]'::jsonb),
  ('appointment-reminder','Rendez-vous → rappel 24 h avant','Affiche un rappel à l’équipe commerciale lorsqu’un rendez-vous entre dans la fenêtre des prochaines 24 heures.','appointment_reminder',false,'{"hours_before":24}'::jsonb,'[{"type":"notify_role","role":"sales","title":"Rendez-vous demain","subtitle":"{{lead}} · {{appointment_time}}","href":"/admin/rendez-vous","severity":"info"}]'::jsonb),
  ('stale-lead-followup','Prospect sans suivi → relance','Crée une relance lorsqu’un prospect actif n’a pas été contacté depuis plusieurs jours.','stale_lead',false,'{"days_without_contact":5}'::jsonb,'[{"type":"create_crm_task","title":"Relancer {{lead}}","due_in_hours":4,"priority":"normal"},{"type":"notify_role","role":"sales","title":"Prospect à relancer","subtitle":"{{lead}} n’a pas eu de suivi récent.","href":"/admin/crm?lead={{lead_id}}","severity":"warning"}]'::jsonb)
on conflict (template_key) do nothing;
