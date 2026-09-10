"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BellRing, Clock3, Loader2, Play, Plus, RefreshCw, Save, ToggleLeft, ToggleRight, Trash2, Zap } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";

type TriggerType = "new_lead" | "urgent_ticket" | "appointment_reminder" | "stale_lead";
type Rule = {
  id: string;
  template_key: string | null;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
  enabled: boolean;
  conditions: Record<string, unknown>;
  actions: unknown[];
  created_by: string | null;
  last_run_at: string | null;
  run_count: number;
  updated_at: string;
};
type Run = { id: string; rule_id: string; source_type: string | null; source_id: string | null; status: "running" | "success" | "failed" | "skipped"; error: string | null; started_at: string; completed_at: string | null };

const triggerLabels: Record<TriggerType, string> = {
  new_lead: "Nouveau lead",
  urgent_ticket: "Ticket urgent",
  appointment_reminder: "Rendez-vous imminent",
  stale_lead: "Prospect sans suivi",
};

const triggerDescriptions: Record<TriggerType, string> = {
  new_lead: "Se déclenche lorsqu’un nouveau prospect entre dans le CRM.",
  urgent_ticket: "Se déclenche lorsqu’un ticket atteint la priorité urgente.",
  appointment_reminder: "Se déclenche lorsqu’un rendez-vous entre dans la fenêtre définie.",
  stale_lead: "Se déclenche lorsqu’un prospect actif reste sans contact pendant plusieurs jours.",
};

function date(value: string | null) {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function actionLabel(action: unknown) {
  if (!action || typeof action !== "object") return "Action";
  const row = action as Record<string, unknown>;
  if (row.type === "create_crm_task") return `Créer une tâche CRM${row.due_in_hours ? ` · +${row.due_in_hours} h` : ""}`;
  if (row.type === "notify_role") return `Notifier ${row.role === "sales" ? "Commercial" : row.role === "support" ? "Support" : String(row.role || "équipe")}`;
  return String(row.type || "Action");
}

export default function AutomationsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState<TriggerType>("new_lead");
  const [drafts, setDrafts] = useState<Record<string, { name: string; description: string; parameter: number }>>({});

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/automations", { cache: "no-store" });
      if (response.status === 401) { location.href = "/admin/login"; return; }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error ?? "Impossible de charger les automatisations."); return; }
      const nextRules = payload.rules ?? [];
      setRules(nextRules);
      setRuns(payload.runs ?? []);
      setDrafts(Object.fromEntries(nextRules.map((rule: Rule) => [rule.id, {
        name: rule.name,
        description: rule.description ?? "",
        parameter: rule.trigger_type === "appointment_reminder" ? Number(rule.conditions?.hours_before ?? 24) : rule.trigger_type === "stale_lead" ? Number(rule.conditions?.days_without_contact ?? 5) : 0,
      }])));
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const enabledCount = rules.filter((rule) => rule.enabled).length;
  const successCount = runs.filter((run) => run.status === "success").length;
  const failedCount = runs.filter((run) => run.status === "failed").length;
  const recentRuns = useMemo(() => runs.slice(0, 12), [runs]);

  async function toggle(rule: Rule) {
    setBusy(`toggle:${rule.id}`);
    setMessage("");
    try {
      const response = await fetch("/api/admin/automations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error ?? "Modification impossible."); return; }
      await load();
    } finally { setBusy(""); }
  }

  async function save(rule: Rule) {
    const draft = drafts[rule.id];
    if (!draft) return;
    const conditions = { ...rule.conditions };
    if (rule.trigger_type === "appointment_reminder") conditions.hours_before = Math.max(1, Math.min(168, Number(draft.parameter || 24)));
    if (rule.trigger_type === "stale_lead") conditions.days_without_contact = Math.max(1, Math.min(90, Number(draft.parameter || 5)));
    setBusy(`save:${rule.id}`);
    setMessage("");
    try {
      const response = await fetch("/api/admin/automations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rule.id, name: draft.name, description: draft.description, conditions }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error ?? "Enregistrement impossible."); return; }
      setMessage("Automatisation enregistrée.");
      await load();
    } finally { setBusy(""); }
  }

  async function run(ruleId?: string) {
    setBusy(`run:${ruleId || "all"}`);
    setMessage("");
    try {
      const response = await fetch("/api/admin/automations/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ruleId ? { ruleId } : {}) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error ?? "Exécution impossible."); return; }
      const summary = payload.summary ?? {};
      setMessage(`Exécution terminée : ${summary.success ?? 0} action(s), ${summary.skipped ?? 0} déjà traitée(s), ${summary.failed ?? 0} erreur(s).`);
      await load();
    } finally { setBusy(""); }
  }

  async function createRule() {
    if (!newName.trim()) { setMessage("Donnez un nom à l’automatisation."); return; }
    setBusy("create");
    setMessage("");
    try {
      const response = await fetch("/api/admin/automations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, triggerType: newTrigger, enabled: false }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error ?? "Création impossible."); return; }
      setNewName(""); setNewOpen(false); setMessage("Automatisation créée en mode désactivé."); await load();
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
      <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#9d4c27]">Performance & système</p><h1 className="moony-serif mt-1 text-4xl tracking-[-.035em] text-[#5b2f22]">Automatisations</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b2f22]/52">Créez des règles qui transforment les événements du Control Center en tâches, rappels et alertes sans suivi manuel.</p></div>
      <div className="flex gap-2"><button onClick={() => void run()} disabled={busy === "run:all" || loading} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm disabled:opacity-50">{busy === "run:all" ? <Loader2 size={15} className="animate-spin"/> : <Play size={15}/>} Exécuter maintenant</button><button onClick={() => setNewOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-4 py-2.5 text-sm font-medium text-white"><Plus size={15}/> Nouvelle règle</button></div>
    </div>

    {message ? <div className="mt-5 rounded-xl border border-[#d8bda9] bg-[#fff8f2] px-4 py-3 text-xs text-[#6f351f]">{message}</div> : null}

    <div className="mt-6 grid gap-3 sm:grid-cols-3"><article className="admin-card admin-shadow p-5"><Zap size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{enabledCount}</strong><span className="text-[10px] text-[#5b2f22]/45">règles actives</span></article><article className="admin-card admin-shadow p-5"><Activity size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{successCount}</strong><span className="text-[10px] text-[#5b2f22]/45">exécutions réussies récentes</span></article><article className="admin-card admin-shadow p-5"><BellRing size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{failedCount}</strong><span className="text-[10px] text-[#5b2f22]/45">erreurs récentes</span></article></div>

    {newOpen ? <section className="mt-5 admin-card admin-shadow p-5"><div className="flex items-center justify-between"><div><h2 className="moony-serif text-2xl">Nouvelle automatisation</h2><p className="text-xs text-[#5b2f22]/45">Une définition adaptée au déclencheur sera créée automatiquement.</p></div><button onClick={() => setNewOpen(false)} className="text-xs text-[#7e3518]">Fermer</button></div><div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_auto]"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ex. Relance partenaires" className="rounded-lg border border-[#5b2f22]/12 bg-white px-3 py-2.5 text-sm outline-none"/><select value={newTrigger} onChange={(event) => setNewTrigger(event.target.value as TriggerType)} className="rounded-lg border border-[#5b2f22]/12 bg-white px-3 py-2.5 text-sm">{Object.entries(triggerLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><button onClick={() => void createRule()} disabled={busy === "create"} className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white">Créer</button></div></section> : null}

    <section className="mt-5 space-y-3">
      {loading && !rules.length ? <div className="admin-card py-16 text-center text-xs text-[#5b2f22]/42">Chargement des règles…</div> : rules.map((rule) => { const draft = drafts[rule.id] ?? { name: rule.name, description: rule.description ?? "", parameter: 0 }; return <article key={rule.id} className="admin-card admin-shadow overflow-hidden"><div className="grid gap-4 p-5 xl:grid-cols-[1fr_1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${rule.enabled ? "bg-emerald-100 text-emerald-700" : "bg-[#eee8e3] text-[#5b2f22]/55"}`}>{rule.enabled ? "ACTIVE" : "DÉSACTIVÉE"}</span><span className="rounded-full bg-[#f7eee8] px-2.5 py-1 text-[9px] text-[#7e3518]">{triggerLabels[rule.trigger_type]}</span>{rule.template_key ? <span className="text-[9px] text-[#5b2f22]/35">Règle MOONY</span> : null}</div><input value={draft.name} onChange={(event) => setDrafts((current) => ({ ...current, [rule.id]: { ...draft, name: event.target.value } }))} className="moony-serif mt-3 w-full bg-transparent text-2xl outline-none"/><textarea value={draft.description} onChange={(event) => setDrafts((current) => ({ ...current, [rule.id]: { ...draft, description: event.target.value } }))} rows={2} className="mt-1 w-full resize-none bg-transparent text-xs leading-5 text-[#5b2f22]/50 outline-none"/><p className="mt-2 text-[10px] text-[#5b2f22]/38">{triggerDescriptions[rule.trigger_type]}</p></div>
      <div className="rounded-xl border border-[#5b2f22]/8 bg-[#fffaf6] p-4"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#5b2f22]/42">Quand → alors</p>{rule.trigger_type === "appointment_reminder" ? <label className="mt-3 block text-xs">Rappeler <input type="number" min={1} max={168} value={draft.parameter} onChange={(event) => setDrafts((current) => ({ ...current, [rule.id]: { ...draft, parameter: Number(event.target.value) } }))} className="mx-1 w-16 rounded border border-[#5b2f22]/10 px-2 py-1"/> h avant</label> : null}{rule.trigger_type === "stale_lead" ? <label className="mt-3 block text-xs">Après <input type="number" min={1} max={90} value={draft.parameter} onChange={(event) => setDrafts((current) => ({ ...current, [rule.id]: { ...draft, parameter: Number(event.target.value) } }))} className="mx-1 w-16 rounded border border-[#5b2f22]/10 px-2 py-1"/> jours sans contact</label> : null}<div className="mt-3 flex flex-wrap gap-2">{(rule.actions ?? []).map((action,index) => <span key={index} className="rounded-full border border-[#9d4c27]/15 bg-white px-2.5 py-1 text-[9px] text-[#7e3518]">{actionLabel(action)}</span>)}</div><div className="mt-3 flex items-center gap-2 text-[9px] text-[#5b2f22]/40"><Clock3 size={12}/> Dernière exécution : {date(rule.last_run_at)} · {rule.run_count || 0} réussite(s)</div></div>
      <div className="flex flex-row gap-2 xl:flex-col xl:items-stretch"><button onClick={() => void toggle(rule)} disabled={busy === `toggle:${rule.id}`} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${rule.enabled ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-[#5b2f22]/12 bg-white text-[#5b2f22]"}`}>{rule.enabled ? <ToggleRight size={17}/> : <ToggleLeft size={17}/>} {rule.enabled ? "Active" : "Activer"}</button><button onClick={() => void save(rule)} disabled={busy === `save:${rule.id}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-3 py-2 text-xs"><Save size={14}/> Enregistrer</button><button onClick={() => void run(rule.id)} disabled={!rule.enabled || busy === `run:${rule.id}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#7e3518] px-3 py-2 text-xs text-white disabled:opacity-40">{busy === `run:${rule.id}` ? <Loader2 size={14} className="animate-spin"/> : <Play size={14}/>} Tester</button>{!rule.template_key ? <button onClick={() => void remove(rule)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-100 px-3 py-2 text-xs text-red-600"><Trash2 size={14}/> Supprimer</button> : null}</div></div></article>; })}
    </section>

    <section className="mt-5 admin-card admin-shadow overflow-hidden"><div className="flex items-center border-b border-[#5b2f22]/8 px-5 py-4"><div><h2 className="moony-serif text-2xl">Exécutions récentes</h2><p className="text-[10px] text-[#5b2f22]/42">Une exécution est dédupliquée pour éviter les tâches et alertes en double.</p></div><button onClick={() => void load()} className="ml-auto rounded-lg border border-[#5b2f22]/10 p-2"><RefreshCw size={14}/></button></div><div className="divide-y divide-[#5b2f22]/7">{recentRuns.length ? recentRuns.map((run) => { const rule = rules.find((item) => item.id === run.rule_id); return <div key={run.id} className="grid gap-2 px-5 py-3 text-xs sm:grid-cols-[1fr_150px_180px]"><div><strong>{rule?.name || "Automatisation"}</strong><p className="mt-0.5 text-[10px] text-[#5b2f22]/42">{run.source_type || "source"}{run.source_id ? ` · ${run.source_id.slice(0,8)}` : ""}{run.error ? ` · ${run.error}` : ""}</p></div><span className={`w-fit rounded-full px-2 py-1 text-[9px] ${run.status === "success" ? "bg-emerald-100 text-emerald-700" : run.status === "failed" ? "bg-red-100 text-red-700" : run.status === "skipped" ? "bg-[#eee8e3] text-[#5b2f22]/55" : "bg-amber-100 text-amber-700"}`}>{run.status}</span><time className="text-[10px] text-[#5b2f22]/42">{date(run.started_at)}</time></div>; }) : <div className="py-12 text-center text-xs text-[#5b2f22]/42">Aucune exécution enregistrée.</div>}</div></section>
  </AdminShell>;
}
