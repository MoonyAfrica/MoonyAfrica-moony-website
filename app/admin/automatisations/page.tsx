"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, BellRing, ChevronDown, ChevronUp, Clock3, Copy, Loader2, Mail, Play, Plus,
  RefreshCw, Save, Settings2, ToggleLeft, ToggleRight, Trash2, Workflow, Zap,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";

type TriggerType = "new_lead" | "urgent_ticket" | "appointment_reminder" | "stale_lead";
type ActionType = "create_crm_task" | "notify_role" | "send_email" | "update_lead_stage" | "add_crm_note" | "run_rule";
type Action = Record<string, unknown> & { type: ActionType; delay_hours?: number };
type Rule = {
  id: string;
  template_key: string | null;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
  enabled: boolean;
  conditions: Record<string, unknown>;
  actions: Action[];
  created_by: string | null;
  last_run_at: string | null;
  run_count: number;
  updated_at: string;
};
type Run = { id: string; rule_id: string; source_type: string | null; source_id: string | null; status: "running" | "success" | "failed" | "skipped"; error: string | null; started_at: string; completed_at: string | null };
type Job = { id: string; rule_id: string | null; source_type: string | null; source_id: string | null; status: "pending" | "running" | "success" | "failed" | "cancelled"; scheduled_at: string; error: string | null; created_at: string; completed_at: string | null };
type Draft = { name: string; description: string; conditions: Record<string, unknown>; actions: Action[] };
type Capabilities = { email: boolean; cron: boolean };

const triggerLabels: Record<TriggerType, string> = {
  new_lead: "Nouveau lead",
  urgent_ticket: "Ticket urgent",
  appointment_reminder: "Rendez-vous imminent",
  stale_lead: "Prospect sans suivi",
};
const triggerDescriptions: Record<TriggerType, string> = {
  new_lead: "À l’arrivée d’un nouveau prospect dans le CRM.",
  urgent_ticket: "Quand un ticket devient urgent.",
  appointment_reminder: "Quand un rendez-vous entre dans la fenêtre de rappel.",
  stale_lead: "Quand un prospect actif reste sans suivi.",
};
const actionLabels: Record<ActionType, string> = {
  create_crm_task: "Créer une tâche CRM",
  notify_role: "Créer une notification",
  send_email: "Envoyer un e-mail",
  update_lead_stage: "Changer l’étape CRM",
  add_crm_note: "Ajouter une note CRM",
  run_rule: "Enchaîner une autre règle",
};
const roles = ["founder", "admin", "sales", "marketing", "content", "support", "analytics"];
const stages = ["new", "to_contact", "contacted", "appointment", "proposal", "negotiation", "won", "lost"];
const priorities = ["low", "normal", "high", "urgent"];

function date(value: string | null | undefined) {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function text(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function listText(value: unknown) { return Array.isArray(value) ? value.join(", ") : ""; }
function parseList(value: string) { return value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean); }
function actionDefault(type: ActionType): Action {
  if (type === "create_crm_task") return { type, delay_hours: 0, title: "Relancer {{lead}}", due_in_hours: 24, priority: "normal", assigned_to: "{{assigned_to}}", notes: "" };
  if (type === "notify_role") return { type, delay_hours: 0, role: "sales", title: "Notification MOONY", subtitle: "{{lead}}", href: "/admin/activite", severity: "info", expires_in_hours: 168 };
  if (type === "send_email") return { type, delay_hours: 0, to: "{{email}}", subject: "Message de MOONY", body: "Bonjour {{first_name}},\n\n" };
  if (type === "update_lead_stage") return { type, delay_hours: 0, status: "contacted" };
  if (type === "add_crm_note") return { type, delay_hours: 0, summary: "Note automatique", body: "" };
  return { type, delay_hours: 0, rule_id: "" };
}

export default function AutomationsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities>({ email: false, cron: false });
  const [jobsAvailable, setJobsAvailable] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [openRule, setOpenRule] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState<TriggerType>("new_lead");
  const [actionPicker, setActionPicker] = useState<Record<string, ActionType>>({});

  async function load() {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/admin/automations", { cache: "no-store" });
      if (response.status === 401) { location.href = "/admin/login"; return; }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error ?? "Impossible de charger les automatisations."); return; }
      const nextRules = (payload.rules ?? []) as Rule[];
      setRules(nextRules); setRuns(payload.runs ?? []); setJobs(payload.jobs ?? []);
      setCapabilities(payload.capabilities ?? { email: false, cron: false });
      setJobsAvailable(payload.jobsAvailable ?? true);
      setDrafts(Object.fromEntries(nextRules.map((rule) => [rule.id, {
        name: rule.name,
        description: rule.description ?? "",
        conditions: { ...(rule.conditions ?? {}) },
        actions: (rule.actions ?? []).map((action) => ({ ...action })),
      }])));
      setActionPicker((current) => ({ ...Object.fromEntries(nextRules.map((rule) => [rule.id, current[rule.id] ?? "create_crm_task"])) }));
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const enabledCount = rules.filter((rule) => rule.enabled).length;
  const failedCount = runs.filter((run) => run.status === "failed").length + jobs.filter((job) => job.status === "failed").length;
  const pendingJobs = jobs.filter((job) => job.status === "pending").length;
  const recentRuns = useMemo(() => runs.slice(0, 10), [runs]);

  function setDraft(ruleId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [ruleId]: { ...current[ruleId], ...patch } }));
  }
  function setCondition(ruleId: string, key: string, value: unknown) {
    const draft = drafts[ruleId]; if (!draft) return;
    const conditions = { ...draft.conditions };
    if (value === "" || (Array.isArray(value) && !value.length)) delete conditions[key]; else conditions[key] = value;
    setDraft(ruleId, { conditions });
  }
  function setAction(ruleId: string, index: number, key: string, value: unknown) {
    const draft = drafts[ruleId]; if (!draft) return;
    const actions = draft.actions.map((action, position) => position === index ? { ...action, [key]: value } : action);
    setDraft(ruleId, { actions });
  }
  function changeActionType(ruleId: string, index: number, type: ActionType) {
    const draft = drafts[ruleId]; if (!draft) return;
    setDraft(ruleId, { actions: draft.actions.map((action, position) => position === index ? actionDefault(type) : action) });
  }
  function moveAction(ruleId: string, index: number, direction: -1 | 1) {
    const draft = drafts[ruleId]; if (!draft) return;
    const target = index + direction; if (target < 0 || target >= draft.actions.length) return;
    const actions = [...draft.actions]; [actions[index], actions[target]] = [actions[target], actions[index]]; setDraft(ruleId, { actions });
  }
  function removeAction(ruleId: string, index: number) {
    const draft = drafts[ruleId]; if (!draft) return;
    setDraft(ruleId, { actions: draft.actions.filter((_, position) => position !== index) });
  }
  function addAction(ruleId: string) {
    const draft = drafts[ruleId]; if (!draft) return;
    const type = actionPicker[ruleId] ?? "create_crm_task";
    setDraft(ruleId, { actions: [...draft.actions, actionDefault(type)] });
  }

  async function toggle(rule: Rule) {
    setBusy(`toggle:${rule.id}`); setMessage("");
    try {
      const response = await fetch("/api/admin/automations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error ?? "Modification impossible."); return; }
      await load();
    } finally { setBusy(""); }
  }

  async function save(rule: Rule) {
    const draft = drafts[rule.id]; if (!draft) return;
    setBusy(`save:${rule.id}`); setMessage("");
    try {
      const response = await fetch("/api/admin/automations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rule.id, name: draft.name, description: draft.description, conditions: draft.conditions, actions: draft.actions }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error ?? "Enregistrement impossible."); return; }
      setMessage(`« ${draft.name} » enregistrée.`); await load();
    } finally { setBusy(""); }
  }

  async function run(ruleId?: string) {
    setBusy(`run:${ruleId || "all"}`); setMessage("");
    try {
      const response = await fetch("/api/admin/automations/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ruleId ? { ruleId } : {}) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error ?? "Exécution impossible."); return; }
      const summary = payload.summary ?? {};
      setMessage(`Exécution terminée : ${summary.success ?? 0} réussie(s), ${summary.skipped ?? 0} déjà traitée(s), ${summary.failed ?? 0} erreur(s).`); await load();
    } finally { setBusy(""); }
  }

  async function createRule() {
    if (!newName.trim()) { setMessage("Donnez un nom à l’automatisation."); return; }
    setBusy("create"); setMessage("");
    try {
      const response = await fetch("/api/admin/automations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, triggerType: newTrigger, enabled: false }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error ?? "Création impossible."); return; }
      setNewName(""); setNewOpen(false); setOpenRule(payload.rule?.id ?? null); setMessage("Automatisation créée en mode désactivé."); await load();
    } finally { setBusy(""); }
  }

  async function remove(rule: Rule) {
    if (!confirm(`Supprimer « ${rule.name} » ?`)) return;
    setBusy(`delete:${rule.id}`);
    try {
      const response = await fetch(`/api/admin/automations?id=${encodeURIComponent(rule.id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error ?? "Suppression impossible."); return; }
      await load();
    } finally { setBusy(""); }
  }

  return <AdminShell active="Automatisations">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#9d4c27]">Performance & système</p><h1 className="moony-serif mt-1 text-4xl tracking-[-.035em] text-[#5b2f22]">Automatisations</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b2f22]/52">Construisez des scénarios multi-conditions et multi-actions : tâches CRM, notifications, e-mails, changements d’étape, délais et enchaînements.</p></div>
      <div className="flex gap-2"><button onClick={() => void run()} disabled={busy === "run:all" || loading} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm disabled:opacity-50">{busy === "run:all" ? <Loader2 size={15} className="animate-spin"/> : <Play size={15}/>} Exécuter maintenant</button><button onClick={() => setNewOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-4 py-2.5 text-sm font-medium text-white"><Plus size={15}/> Nouvelle règle</button></div>
    </div>

    {message ? <div className="mt-5 rounded-xl border border-[#d8bda9] bg-[#fff8f2] px-4 py-3 text-xs text-[#6f351f]">{message}</div> : null}
    {!jobsAvailable ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Appliquez la migration Automation Builder V2 pour activer les actions différées.</div> : null}
    {!capabilities.cron ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Le secret cron n’est pas configuré : les règles événementielles fonctionnent, mais les rappels planifiés et actions différées nécessitent <code>AUTOMATION_CRON_SECRET</code> et un scheduler.</div> : null}

    <div className="mt-6 grid gap-3 sm:grid-cols-4">
      <article className="admin-card admin-shadow p-5"><Zap size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{enabledCount}</strong><span className="text-[10px] text-[#5b2f22]/45">règles actives</span></article>
      <article className="admin-card admin-shadow p-5"><Activity size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{runs.filter((run) => run.status === "success").length}</strong><span className="text-[10px] text-[#5b2f22]/45">exécutions réussies</span></article>
      <article className="admin-card admin-shadow p-5"><Clock3 size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{pendingJobs}</strong><span className="text-[10px] text-[#5b2f22]/45">actions différées</span></article>
      <article className="admin-card admin-shadow p-5"><BellRing size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{failedCount}</strong><span className="text-[10px] text-[#5b2f22]/45">erreurs récentes</span></article>
    </div>

    {newOpen ? <section className="mt-5 admin-card admin-shadow p-5"><div className="flex items-center justify-between"><div><h2 className="moony-serif text-2xl">Nouvelle automatisation</h2><p className="text-xs text-[#5b2f22]/45">Elle sera créée désactivée pour être configurée avant lancement.</p></div><button onClick={() => setNewOpen(false)} className="text-xs text-[#7e3518]">Fermer</button></div><div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_auto]"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ex. Relance partenaires" className="rounded-lg border border-[#5b2f22]/12 bg-white px-3 py-2.5 text-sm outline-none"/><select value={newTrigger} onChange={(event) => setNewTrigger(event.target.value as TriggerType)} className="rounded-lg border border-[#5b2f22]/12 bg-white px-3 py-2.5 text-sm">{Object.entries(triggerLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><button onClick={() => void createRule()} disabled={busy === "create"} className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white">Créer</button></div></section> : null}

    <section className="mt-5 space-y-3">
      {loading && !rules.length ? <div className="admin-card py-16 text-center text-xs text-[#5b2f22]/42">Chargement des règles…</div> : rules.map((rule) => {
        const draft = drafts[rule.id]; if (!draft) return null;
        const expanded = openRule === rule.id;
        return <article key={rule.id} className="admin-card admin-shadow overflow-hidden">
          <div className="grid gap-4 p-5 xl:grid-cols-[1fr_auto]">
            <div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${rule.enabled ? "bg-emerald-100 text-emerald-700" : "bg-[#eee8e3] text-[#5b2f22]/55"}`}>{rule.enabled ? "ACTIVE" : "DÉSACTIVÉE"}</span><span className="rounded-full bg-[#f7eee8] px-2.5 py-1 text-[9px] text-[#7e3518]">{triggerLabels[rule.trigger_type]}</span>{rule.template_key ? <span className="text-[9px] text-[#5b2f22]/35">Règle MOONY</span> : null}<span className="text-[9px] text-[#5b2f22]/35">{draft.actions.length} action{draft.actions.length > 1 ? "s" : ""}</span></div><h2 className="moony-serif mt-3 text-2xl">{draft.name}</h2><p className="mt-1 text-xs text-[#5b2f22]/48">{draft.description || triggerDescriptions[rule.trigger_type]}</p><p className="mt-2 text-[9px] text-[#5b2f22]/35">Dernière exécution : {date(rule.last_run_at)} · {rule.run_count} exécution(s)</p></div>
            <div className="flex flex-wrap items-center gap-2"><button onClick={() => setOpenRule(expanded ? null : rule.id)} className="inline-flex items-center gap-1 rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs"><Settings2 size={14}/> {expanded ? "Fermer" : "Configurer"}</button><button onClick={() => void toggle(rule)} disabled={busy === `toggle:${rule.id}`} className="rounded-lg border border-[#5b2f22]/10 bg-white p-2.5 text-[#7e3518]" title={rule.enabled ? "Désactiver" : "Activer"}>{rule.enabled ? <ToggleRight size={20}/> : <ToggleLeft size={20}/>}</button><button onClick={() => void run(rule.id)} disabled={busy === `run:${rule.id}`} className="rounded-lg border border-[#5b2f22]/10 bg-white p-2.5 text-[#7e3518]" title="Tester maintenant">{busy === `run:${rule.id}` ? <Loader2 size={18} className="animate-spin"/> : <Play size={18}/>}</button>{!rule.template_key ? <button onClick={() => void remove(rule)} className="rounded-lg border border-red-100 bg-white p-2.5 text-red-500" title="Supprimer"><Trash2 size={18}/></button> : null}</div>
          </div>

          {expanded ? <div className="border-t border-[#5b2f22]/8 bg-[#fffdf9] p-5">
            <div className="grid gap-5 2xl:grid-cols-[.9fr_1.3fr]">
              <section className="space-y-4">
                <div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#9d4c27]">1 · Identité & conditions</p><div className="mt-3 grid gap-3"><label className="text-[10px] text-[#5b2f22]/50">Nom<input value={draft.name} onChange={(event) => setDraft(rule.id, { name: event.target.value })} className="mt-1 block w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5 text-sm text-[#301b15]"/></label><label className="text-[10px] text-[#5b2f22]/50">Description<textarea value={draft.description} onChange={(event) => setDraft(rule.id, { description: event.target.value })} rows={2} className="mt-1 block w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5 text-sm text-[#301b15]"/></label></div></div>
                <div className="rounded-xl border border-[#5b2f22]/8 bg-[#fff8f3] p-4"><strong className="text-xs">Déclencheur : {triggerLabels[rule.trigger_type]}</strong><p className="mt-1 text-[10px] leading-4 text-[#5b2f22]/45">{triggerDescriptions[rule.trigger_type]}</p>{rule.trigger_type === "appointment_reminder" ? <label className="mt-3 block text-[10px]">Fenêtre de rappel (heures)<input type="number" min={1} max={168} value={number(draft.conditions.hours_before,24)} onChange={(event) => setCondition(rule.id,"hours_before",Number(event.target.value))} className="mt-1 block w-28 rounded border border-[#5b2f22]/10 bg-white px-2 py-2 text-xs"/></label> : null}{rule.trigger_type === "stale_lead" ? <label className="mt-3 block text-[10px]">Jours sans contact<input type="number" min={1} max={90} value={number(draft.conditions.days_without_contact,5)} onChange={(event) => setCondition(rule.id,"days_without_contact",Number(event.target.value))} className="mt-1 block w-28 rounded border border-[#5b2f22]/10 bg-white px-2 py-2 text-xs"/></label> : null}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-[10px] text-[#5b2f22]/50">Étapes CRM (séparées par virgules)<input value={listText(draft.conditions.statuses)} onChange={(event) => setCondition(rule.id,"statuses",parseList(event.target.value))} placeholder="new, to_contact" className="mt-1 block w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs"/></label>
                  <label className="text-[10px] text-[#5b2f22]/50">Pays<input value={listText(draft.conditions.countries)} onChange={(event) => setCondition(rule.id,"countries",parseList(event.target.value))} placeholder="senegal, france" className="mt-1 block w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs"/></label>
                  <label className="text-[10px] text-[#5b2f22]/50">Besoins / types de lead<input value={listText(draft.conditions.needs)} onChange={(event) => setCondition(rule.id,"needs",parseList(event.target.value))} placeholder="partenariat, entreprise" className="mt-1 block w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs"/></label>
                  <label className="text-[10px] text-[#5b2f22]/50">Responsables<input value={listText(draft.conditions.assignees)} onChange={(event) => setCondition(rule.id,"assignees",parseList(event.target.value))} placeholder="Fabienne" className="mt-1 block w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs"/></label>
                  <label className="text-[10px] text-[#5b2f22]/50">Sources<input value={listText(draft.conditions.sources)} onChange={(event) => setCondition(rule.id,"sources",parseList(event.target.value))} placeholder="website-contact-form" className="mt-1 block w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs"/></label>
                  <label className="text-[10px] text-[#5b2f22]/50">Priorités ticket<input value={listText(draft.conditions.priorities)} onChange={(event) => setCondition(rule.id,"priorities",parseList(event.target.value))} placeholder="urgent" className="mt-1 block w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs"/></label>
                  <label className="text-[10px] text-[#5b2f22]/50">Montant minimum<input type="number" min={0} value={draft.conditions.min_deal_value === undefined ? "" : number(draft.conditions.min_deal_value)} onChange={(event) => setCondition(rule.id,"min_deal_value",event.target.value === "" ? "" : Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs"/></label>
                  <label className="text-[10px] text-[#5b2f22]/50">Montant maximum<input type="number" min={0} value={draft.conditions.max_deal_value === undefined ? "" : number(draft.conditions.max_deal_value)} onChange={(event) => setCondition(rule.id,"max_deal_value",event.target.value === "" ? "" : Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs"/></label>
                  <label className="text-[10px] text-[#5b2f22]/50 sm:col-span-2">Entreprise contient<input value={text(draft.conditions.company_contains)} onChange={(event) => setCondition(rule.id,"company_contains",event.target.value)} placeholder="Ex. Orange" className="mt-1 block w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs"/></label>
                </div>
              </section>

              <section><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#9d4c27]">2 · Actions</p><p className="mt-1 text-[10px] text-[#5b2f22]/45">Les actions s’exécutent dans cet ordre. Ajoutez un délai pour les programmer plus tard.</p></div><div className="flex gap-2"><select value={actionPicker[rule.id] ?? "create_crm_task"} onChange={(event) => setActionPicker((current) => ({ ...current, [rule.id]: event.target.value as ActionType }))} className="rounded-lg border border-[#5b2f22]/10 bg-white px-2 py-2 text-[10px]">{Object.entries(actionLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select><button onClick={() => addAction(rule.id)} className="inline-flex items-center gap-1 rounded-lg bg-[#7e3518] px-3 py-2 text-[10px] text-white"><Plus size={12}/> Ajouter</button></div></div>
                <div className="mt-3 space-y-3">{draft.actions.length ? draft.actions.map((action,index) => <div key={`${action.type}-${index}`} className="rounded-xl border border-[#5b2f22]/9 bg-white p-4"><div className="flex flex-wrap items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#f3e5db] text-[10px] font-semibold text-[#7e3518]">{index+1}</span><select value={action.type} onChange={(event) => changeActionType(rule.id,index,event.target.value as ActionType)} className="rounded-lg border border-[#5b2f22]/10 px-2 py-1.5 text-xs font-medium">{Object.entries(actionLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select><label className="ml-auto flex items-center gap-1 text-[9px] text-[#5b2f22]/45">Délai <input type="number" min={0} max={720} value={number(action.delay_hours,0)} onChange={(event) => setAction(rule.id,index,"delay_hours",Number(event.target.value))} className="w-16 rounded border border-[#5b2f22]/10 px-2 py-1.5 text-xs"/> h</label><button onClick={() => moveAction(rule.id,index,-1)} disabled={index===0} className="rounded border border-[#5b2f22]/10 p-1.5 disabled:opacity-25"><ChevronUp size={12}/></button><button onClick={() => moveAction(rule.id,index,1)} disabled={index===draft.actions.length-1} className="rounded border border-[#5b2f22]/10 p-1.5 disabled:opacity-25"><ChevronDown size={12}/></button><button onClick={() => removeAction(rule.id,index)} className="rounded border border-red-100 p-1.5 text-red-500"><Trash2 size={12}/></button></div>
                  {action.type === "create_crm_task" ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={text(action.title)} onChange={(e)=>setAction(rule.id,index,"title",e.target.value)} placeholder="Titre de la tâche" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs sm:col-span-2"/><label className="text-[9px] text-[#5b2f22]/45">Échéance après (h)<input type="number" min={0} value={number(action.due_in_hours,24)} onChange={(e)=>setAction(rule.id,index,"due_in_hours",Number(e.target.value))} className="mt-1 block w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/></label><label className="text-[9px] text-[#5b2f22]/45">Priorité<select value={text(action.priority)||"normal"} onChange={(e)=>setAction(rule.id,index,"priority",e.target.value)} className="mt-1 block w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs">{priorities.map((value)=><option key={value}>{value}</option>)}</select></label><input value={text(action.assigned_to)} onChange={(e)=>setAction(rule.id,index,"assigned_to",e.target.value)} placeholder="Responsable, ex. {{assigned_to}}" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/><input value={text(action.notes)} onChange={(e)=>setAction(rule.id,index,"notes",e.target.value)} placeholder="Note interne" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/></div> : null}
                  {action.type === "notify_role" ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><select value={text(action.role)||"sales"} onChange={(e)=>setAction(rule.id,index,"role",e.target.value)} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs">{roles.map((value)=><option key={value}>{value}</option>)}</select><select value={text(action.severity)||"info"} onChange={(e)=>setAction(rule.id,index,"severity",e.target.value)} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"><option>info</option><option>warning</option><option>urgent</option></select><input value={text(action.title)} onChange={(e)=>setAction(rule.id,index,"title",e.target.value)} placeholder="Titre" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs sm:col-span-2"/><input value={text(action.subtitle)} onChange={(e)=>setAction(rule.id,index,"subtitle",e.target.value)} placeholder="Détail" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/><input value={text(action.href)} onChange={(e)=>setAction(rule.id,index,"href",e.target.value)} placeholder="/admin/..." className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/></div> : null}
                  {action.type === "send_email" ? <div className="mt-3 grid gap-2"><div className="flex items-center gap-2 text-[10px] text-[#5b2f22]/45"><Mail size={12}/>{capabilities.email ? <span className="text-emerald-700">Brevo configuré</span> : <span className="text-amber-700">Brevo à configurer avant activation</span>}</div><input value={text(action.to)} onChange={(e)=>setAction(rule.id,index,"to",e.target.value)} placeholder="{{email}} ou adresse@exemple.com" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/><input value={text(action.subject)} onChange={(e)=>setAction(rule.id,index,"subject",e.target.value)} placeholder="Objet" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/><textarea value={text(action.body)} onChange={(e)=>setAction(rule.id,index,"body",e.target.value)} rows={5} placeholder="Corps de l’e-mail" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/></div> : null}
                  {action.type === "update_lead_stage" ? <div className="mt-3"><select value={text(action.status)||"contacted"} onChange={(e)=>setAction(rule.id,index,"status",e.target.value)} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs">{stages.map((value)=><option key={value}>{value}</option>)}</select></div> : null}
                  {action.type === "add_crm_note" ? <div className="mt-3 grid gap-2"><input value={text(action.summary)} onChange={(e)=>setAction(rule.id,index,"summary",e.target.value)} placeholder="Titre de la note" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/><textarea value={text(action.body)} onChange={(e)=>setAction(rule.id,index,"body",e.target.value)} rows={3} placeholder="Contenu" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/></div> : null}
                  {action.type === "run_rule" ? <div className="mt-3"><select value={text(action.rule_id)} onChange={(e)=>setAction(rule.id,index,"rule_id",e.target.value)} className="w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"><option value="">Choisir la règle suivante…</option>{rules.filter((candidate)=>candidate.id!==rule.id).map((candidate)=><option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.enabled ? "" : " · désactivée"}</option>)}</select><p className="mt-1 text-[9px] text-[#5b2f22]/40">La chaîne est limitée à 4 niveaux pour éviter les boucles.</p></div> : null}
                </div>) : <div className="rounded-xl border border-dashed border-[#5b2f22]/15 p-6 text-center text-xs text-[#5b2f22]/40">Ajoutez au moins une action.</div>}</div>
                <div className="mt-3 rounded-lg bg-[#f8f0e9] px-3 py-2 text-[9px] leading-4 text-[#5b2f22]/50"><strong>Variables :</strong> {"{{lead}}, {{first_name}}, {{last_name}}, {{company}}, {{email}}, {{country}}, {{need}}, {{assigned_to}}, {{deal_value}}, {{ticket_id}}, {{subject}}, {{requester}}, {{appointment_time}}"}</div>
              </section>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#5b2f22]/8 pt-4"><span className="text-[10px] text-[#5b2f22]/40">Les règles système peuvent être désactivées mais pas supprimées.</span><button onClick={() => void save(rule)} disabled={busy === `save:${rule.id}`} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50">{busy === `save:${rule.id}` ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Enregistrer la règle</button></div>
          </div> : null}
        </article>;
      })}
    </section>

    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      <section className="admin-card admin-shadow overflow-hidden"><div className="flex items-center border-b border-[#5b2f22]/8 px-4 py-3"><Activity size={16} className="mr-2 text-[#9d4c27]"/><strong className="text-sm">Exécutions récentes</strong><button onClick={() => void load()} className="ml-auto p-1.5 text-[#7e3518]" title="Actualiser"><RefreshCw size={14}/></button></div><div className="divide-y divide-[#5b2f22]/7">{recentRuns.length ? recentRuns.map((run)=><div key={run.id} className="flex items-start gap-3 px-4 py-3 text-xs"><span className={`mt-1 h-2 w-2 rounded-full ${run.status === "success" ? "bg-emerald-500" : run.status === "failed" ? "bg-red-500" : run.status === "running" ? "bg-amber-500" : "bg-[#b9aaa1]"}`}/><div className="min-w-0 flex-1"><strong className="block truncate">{rules.find((rule)=>rule.id===run.rule_id)?.name || "Automatisation"}</strong><span className="text-[10px] text-[#5b2f22]/42">{run.status} · {date(run.started_at)}</span>{run.error ? <p className="mt-1 text-[10px] text-red-600">{run.error}</p> : null}</div></div>) : <p className="px-4 py-10 text-center text-xs text-[#5b2f22]/40">Aucune exécution pour le moment.</p>}</div></section>
      <section className="admin-card admin-shadow overflow-hidden"><div className="flex items-center border-b border-[#5b2f22]/8 px-4 py-3"><Workflow size={16} className="mr-2 text-[#9d4c27]"/><strong className="text-sm">File des actions différées</strong><span className="ml-auto text-[10px] text-[#5b2f22]/40">{jobs.length} récente(s)</span></div><div className="divide-y divide-[#5b2f22]/7">{jobs.length ? jobs.slice(0,10).map((job)=><div key={job.id} className="flex items-start gap-3 px-4 py-3 text-xs"><span className={`mt-1 h-2 w-2 rounded-full ${job.status === "success" ? "bg-emerald-500" : job.status === "failed" ? "bg-red-500" : job.status === "pending" ? "bg-amber-500" : "bg-[#b9aaa1]"}`}/><div className="min-w-0 flex-1"><strong className="block truncate">{rules.find((rule)=>rule.id===job.rule_id)?.name || "Action différée"}</strong><span className="text-[10px] text-[#5b2f22]/42">{job.status} · prévue {date(job.scheduled_at)}</span>{job.error ? <p className="mt-1 text-[10px] text-red-600">{job.error}</p> : null}</div></div>) : <p className="px-4 py-10 text-center text-xs text-[#5b2f22]/40">Aucune action différée.</p>}</div></section>
    </div>
  </AdminShell>;
}
