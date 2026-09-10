"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  KeyRound,
  Megaphone,
  MessageSquareText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";

type Status = "new" | "to_contact" | "contacted" | "appointment" | "proposal" | "negotiation" | "won" | "lost";
type Viewer = { name: string; email: string; role: string; permissions: string[]; legacy: boolean; mfa: boolean };
type Lead = { id: string; first_name: string; last_name: string; email: string; company: string | null; status: Status; deal_value: number | null; country: string | null; need: string; assigned_to: string | null };
type TaskLead = { first_name: string; last_name: string; company: string | null };
type Task = { id: string; lead_id: string; title: string; due_at: string | null; status: "todo" | "in_progress"; priority: "low" | "normal" | "high" | "urgent"; assigned_to: string | null; website_leads?: TaskLead | TaskLead[] | null };
type Appointment = { id: string; starts_at: string | null; status: string; provider: string | null; notes: string | null; lead_id: string | null };
type Ticket = { id: string; requester_name: string | null; requester_email: string; type: string; subject: string; priority: string; status: string };
type Campaign = { id: string; name: string; subject: string; status: string; scheduled_at?: string | null; stats: Record<string, unknown> };
type ContentItem = { id: string; title: string; slug: string; status: string; updated_at: string; category?: string | null; resource_type?: string | null };
type MarketingElement = { id: string; name: string; kind: string; status: string; start_at: string | null; end_at: string | null; updated_at: string };
type Dashboard = {
  viewer: Viewer | null;
  permissions: string[];
  metrics: { pageViews: number; appClicks: number; leads30d: number; appointments30d: number; conversionRate: number };
  daily: { date: string; views: number }[];
  countries: { name: string; value: number }[];
  leads: Lead[];
  leadSummary: { total: number; new: number; negotiation: number; won: number };
  upcomingAppointments: Appointment[];
  tasks: Task[];
  tasksAvailable: boolean;
  tickets: Ticket[];
  supportSummary: { total: number; open: number; urgent: number; byStatus: Record<string, number> };
  campaigns: Campaign[];
  marketingElements: MarketingElement[];
  marketingSummary: { campaignsDraft: number; campaignsScheduled: number; activeElements: number; scheduledElements: number };
  pages: ContentItem[];
  articles: ContentItem[];
  resources: ContentItem[];
  contentSummary: { pagesDraft: number; pagesPublished: number; articlesDraft: number; articlesPublished: number; resourcesDraft: number; resourcesPublished: number };
  partners: { id: string; name: string; status: string; featured: boolean }[];
  testimonials: { id: string; author_name: string; status: string; featured: boolean }[];
  teamSummary: { available: boolean; total: number; active: number; withoutMfa: number; mustChangePassword: number; activeSessions: number };
};

const empty: Dashboard = {
  viewer: null,
  permissions: [],
  metrics: { pageViews: 0, appClicks: 0, leads30d: 0, appointments30d: 0, conversionRate: 0 },
  daily: [], countries: [], leads: [], leadSummary: { total: 0, new: 0, negotiation: 0, won: 0 },
  upcomingAppointments: [], tasks: [], tasksAvailable: true, tickets: [], supportSummary: { total: 0, open: 0, urgent: 0, byStatus: {} },
  campaigns: [], marketingElements: [], marketingSummary: { campaignsDraft: 0, campaignsScheduled: 0, activeElements: 0, scheduledElements: 0 },
  pages: [], articles: [], resources: [], contentSummary: { pagesDraft: 0, pagesPublished: 0, articlesDraft: 0, articlesPublished: 0, resourcesDraft: 0, resourcesPublished: 0 },
  partners: [], testimonials: [], teamSummary: { available: false, total: 0, active: 0, withoutMfa: 0, mustChangePassword: 0, activeSessions: 0 },
};

const stages: [Status, string][] = [
  ["new", "Nouveau"], ["to_contact", "À contacter"], ["contacted", "Contacté"], ["appointment", "RDV planifié"],
  ["proposal", "Proposition envoyée"], ["negotiation", "Négociation"], ["won", "Signé"], ["lost", "Perdu"],
];

const roleNames: Record<string, string> = {
  founder: "Founder / Super Admin", admin: "Administrateur", sales: "Commercial", marketing: "Marketing",
  content: "Contenu", support: "Support", analytics: "Lecture analytique",
};

const roleCopy: Record<string, string> = {
  founder: "Pilotez les priorités commerciales, éditoriales, marketing, support et sécurité de MOONY depuis une seule vue.",
  admin: "Suivez les opérations du site et les sujets qui demandent une action aujourd’hui.",
  sales: "Concentrez-vous sur les prospects à relancer, les opportunités et les prochains rendez-vous.",
  marketing: "Suivez les campagnes, les activations du site et la performance d’acquisition.",
  content: "Gardez un œil sur les contenus à préparer, publier et mettre à jour.",
  support: "Priorisez les demandes des utilisatrices et les dossiers qui nécessitent une réponse rapide.",
  analytics: "Consultez les tendances de trafic et les indicateurs utiles à la prise de décision.",
};

function money(value: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value); }
function taskLead(task: Task) { const relation = task.website_leads; return Array.isArray(relation) ? relation[0] : relation ?? null; }
function taskDate(value: string | null) { if (!value) return "Sans échéance"; return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function shortDate(value: string) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(value)); }

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      if (response.status === 401) { location.href = "/admin/login"; return; }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setError(payload.error ?? "Le Dashboard n’a pas pu être chargé."); setLoading(false); return; }
      setData({ ...empty, ...payload, viewer: payload.viewer ?? null, tasks: payload.tasks ?? [], tasksAvailable: payload.tasksAvailable ?? true });
      setLoading(false);
    })();
  }, []);

  const permissions = data.viewer?.permissions?.length ? data.viewer.permissions : data.permissions;
  const has = (permission: string) => permissions.includes("*") || permissions.includes(permission);
  const viewerRole = data.viewer?.role ?? "admin";
  const firstName = data.viewer?.name?.trim().split(/\s+/)[0] || "MOONY";
  const now = Date.now();
  const overdueTasks = data.tasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < now);
  const todayKey = new Date().toISOString().slice(0, 10);
  const appointmentsToday = data.upcomingAppointments.filter((item) => item.starts_at?.slice(0, 10) === todayKey);

  const points = useMemo(() => {
    if (!data.daily.length) return "";
    const max = Math.max(1, ...data.daily.map((item) => item.views));
    return data.daily.map((item, index) => `${(index / Math.max(1, data.daily.length - 1)) * 800},${225 - (item.views / max) * 185}`).join(" ");
  }, [data.daily]);
  const countryTotal = data.countries.reduce((sum, item) => sum + item.value, 0);

  const quickActions = useMemo(() => {
    const actions: { label: string; href: string }[] = [];
    const can = (permission: string) => permissions.includes("*") || permissions.includes(permission);
    if (can("crm.write")) actions.push({ label: "Ouvrir le CRM", href: "/admin/crm" });
    if (can("appointments.write")) actions.push({ label: "Planifier un RDV", href: "/admin/rendez-vous" });
    if (can("marketing.write")) actions.push({ label: "Nouvelle campagne", href: "/admin/newsletters" });
    if (can("content.write")) actions.push({ label: "Nouvel article", href: "/admin/articles" });
    if (can("site.write")) actions.push({ label: "Modifier une page", href: "/admin/pages" });
    if (can("support.write")) actions.push({ label: "Boîte de réception", href: "/admin/service-client" });
    if (can("team.manage")) actions.push({ label: "Gérer l’équipe", href: "/admin/equipe" });
    return actions.slice(0, 4);
  }, [permissions]);

  const priorities = useMemo(() => {
    const items: { level: "urgent" | "attention" | "normal"; title: string; detail: string; href: string }[] = [];
    const can = (permission: string) => permissions.includes("*") || permissions.includes(permission);
    const current = Date.now();
    const late = data.tasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < current).length;
    if (can("crm.read") && late) items.push({ level: "urgent", title: `${late} relance${late > 1 ? "s" : ""} en retard`, detail: "Des prospects attendent une action commerciale.", href: "/admin/crm" });
    if (can("crm.read") && data.leadSummary.new) items.push({ level: "attention", title: `${data.leadSummary.new} nouveau${data.leadSummary.new > 1 ? "x" : ""} prospect${data.leadSummary.new > 1 ? "s" : ""}`, detail: "À qualifier ou contacter dans le pipeline.", href: "/admin/crm" });
    if (can("support.read") && data.supportSummary.urgent) items.push({ level: "urgent", title: `${data.supportSummary.urgent} ticket${data.supportSummary.urgent > 1 ? "s" : ""} urgent${data.supportSummary.urgent > 1 ? "s" : ""}`, detail: "Priorité au service client.", href: "/admin/service-client" });
    if (can("support.read") && !data.supportSummary.urgent && data.supportSummary.open) items.push({ level: "attention", title: `${data.supportSummary.open} demande${data.supportSummary.open > 1 ? "s" : ""} ouverte${data.supportSummary.open > 1 ? "s" : ""}`, detail: "Messages encore en attente de résolution.", href: "/admin/service-client" });
    if (can("appointments.read") && appointmentsToday.length) items.push({ level: "normal", title: `${appointmentsToday.length} rendez-vous aujourd’hui`, detail: "Votre agenda mérite un dernier contrôle.", href: "/admin/rendez-vous" });
    const contentDrafts = data.contentSummary.pagesDraft + data.contentSummary.articlesDraft + data.contentSummary.resourcesDraft;
    if ((can("site.read") || can("content.read")) && contentDrafts) items.push({ level: "attention", title: `${contentDrafts} contenu${contentDrafts > 1 ? "s" : ""} à finaliser`, detail: "Brouillons ou éléments en révision avant publication.", href: can("site.read") ? "/admin/pages" : "/admin/articles" });
    if (can("marketing.read") && data.marketingSummary.campaignsScheduled) items.push({ level: "normal", title: `${data.marketingSummary.campaignsScheduled} campagne${data.marketingSummary.campaignsScheduled > 1 ? "s" : ""} programmée${data.marketingSummary.campaignsScheduled > 1 ? "s" : ""}`, detail: "Vérifiez contenu, audience et date d’envoi.", href: "/admin/newsletters" });
    if (can("team.manage") && data.teamSummary.withoutMfa) items.push({ level: "attention", title: `${data.teamSummary.withoutMfa} compte${data.teamSummary.withoutMfa > 1 ? "s" : ""} sans 2FA`, detail: "Renforcez les accès de l’équipe.", href: "/admin/equipe" });
    if (can("team.manage") && data.teamSummary.mustChangePassword) items.push({ level: "normal", title: `${data.teamSummary.mustChangePassword} mot${data.teamSummary.mustChangePassword > 1 ? "s" : ""} de passe temporaire${data.teamSummary.mustChangePassword > 1 ? "s" : ""}`, detail: "Des membres doivent encore choisir leur mot de passe personnel.", href: "/admin/equipe" });
    return items.slice(0, 6);
  }, [data, permissions, appointmentsToday.length]);

  const metricCards = useMemo(() => {
    const cards: { label: string; value: string | number; note: string }[] = [];
    const can = (permission: string) => permissions.includes("*") || permissions.includes(permission);
    if (viewerRole === "support" && can("support.read")) {
      cards.push({ label: "Tickets ouverts", value: data.supportSummary.open, note: "à traiter" }, { label: "Tickets urgents", value: data.supportSummary.urgent, note: "priorité haute" });
    }
    if (viewerRole === "content" && (can("content.read") || can("site.read"))) {
      cards.push({ label: "Pages publiées", value: data.contentSummary.pagesPublished, note: "en ligne" }, { label: "Articles à finaliser", value: data.contentSummary.articlesDraft, note: "brouillon / révision" });
    }
    if (viewerRole === "marketing" && can("marketing.read")) {
      cards.push({ label: "Activations en ligne", value: data.marketingSummary.activeElements, note: "pop-ups, bandeaux, formulaires" }, { label: "Campagnes programmées", value: data.marketingSummary.campaignsScheduled, note: "à venir" });
    }
    if (can("analytics.read")) cards.push({ label: "Pages vues", value: data.metrics.pageViews, note: "30 derniers jours" }, { label: "Clics application", value: data.metrics.appClicks, note: "30 derniers jours" });
    if (can("crm.read")) cards.push({ label: "Prospects actifs", value: data.leadSummary.total, note: `${data.leadSummary.new} nouveaux / à contacter` });
    if (can("appointments.read")) cards.push({ label: "Rendez-vous", value: data.metrics.appointments30d, note: "30 derniers jours" });
    if (can("team.manage")) cards.push({ label: "Équipe active", value: data.teamSummary.active, note: `${data.teamSummary.activeSessions} sessions actives` });
    return cards.slice(0, 5);
  }, [data, permissions, viewerRole]);

  return (
    <AdminShell active="Dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#f2e2d7] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#8a3d20]">{roleNames[viewerRole] ?? viewerRole}</span>
            {data.viewer?.mfa ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] text-emerald-700"><ShieldCheck size={11}/>2FA validée</span> : null}
          </div>
          <h1 className="moony-serif text-4xl tracking-[-.035em] text-[#5b2f22]">Bonjour {firstName} ☀</h1>
          <p className="mt-1 max-w-3xl text-sm text-[#5b2f22]/50">{roleCopy[viewerRole] ?? roleCopy.admin}</p>
        </div>
        <div className="flex flex-wrap gap-2">{quickActions.map((action, index) => <Link key={action.href} href={action.href} className={index === 0 ? "rounded-lg bg-[#7e3518] px-4 py-2.5 text-sm font-medium text-white" : "rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm"}>{action.label}</Link>)}</div>
      </div>

      {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((card) => <article key={card.label} className="admin-card admin-shadow p-5"><p className="text-xs text-[#5b2f22]/52">{card.label}</p><strong className="moony-serif mt-3 block text-3xl font-normal">{loading ? "…" : card.value}</strong><p className="mt-1 text-[10px] text-[#5b2f22]/36">{card.note}</p></article>)}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
        <article className="admin-card admin-shadow p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="moony-serif text-2xl">Priorités du jour</h2><p className="text-xs text-[#5b2f22]/45">Une vue triée selon votre rôle</p></div><span className="rounded-full bg-[#fbf1ea] px-2.5 py-1 text-[10px] text-[#8a3d20]">{priorities.length} à suivre</span></div>
          <div className="mt-4 space-y-2">{priorities.length ? priorities.map((item) => <Link key={`${item.title}-${item.href}`} href={item.href} className="group flex items-start gap-3 rounded-xl border border-[#5b2f22]/8 bg-[#fffdfb] p-3 transition hover:border-[#9d4c27]/25 hover:bg-[#fffaf6]">{item.level === "urgent" ? <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500"/> : item.level === "attention" ? <Clock3 size={16} className="mt-0.5 shrink-0 text-amber-600"/> : <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600"/>}<div className="min-w-0 flex-1"><strong className="block text-xs">{item.title}</strong><span className="mt-1 block text-[10px] leading-4 text-[#5b2f22]/45">{item.detail}</span></div><ArrowRight size={14} className="mt-1 shrink-0 text-[#5b2f22]/25 transition group-hover:translate-x-0.5 group-hover:text-[#8a3d20]"/></Link>) : <div className="py-10 text-center"><CheckCircle2 size={30} className="mx-auto text-emerald-500/60"/><p className="mt-2 text-xs font-medium">Rien d’urgent pour le moment.</p><p className="mt-1 text-[10px] text-[#5b2f22]/40">Le Dashboard fera remonter ici les prochaines actions utiles.</p></div>}</div>
        </article>

        {has("analytics.read") ? <article className="admin-card admin-shadow p-5"><div className="flex items-center justify-between"><div><h2 className="moony-serif text-2xl">Performance du site</h2><p className="text-xs text-[#5b2f22]/45">Pages vues · 30 jours</p></div><Link href="/admin/analytics" className="text-xs text-[#8d3b19]">Voir les détails →</Link></div><div className="mt-5 h-64 rounded-lg border border-[#5b2f22]/8 bg-[#fffdf9] p-4"><svg viewBox="0 0 800 250" className="h-full w-full" preserveAspectRatio="none">{[40,80,120,160,200].map((y) => <line key={y} x1="0" x2="800" y1={y} y2={y} stroke="#eadfd8"/>)}<polyline fill="none" stroke="#8a3d20" strokeWidth="4" vectorEffect="non-scaling-stroke" points={points}/></svg></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[#fbf4ee] p-3"><span className="text-[10px] text-[#5b2f22]/45">Conversion visite → lead</span><strong className="moony-serif mt-1 block text-2xl font-normal">{data.metrics.conversionRate}%</strong></div><div className="rounded-xl bg-[#fbf4ee] p-3"><span className="text-[10px] text-[#5b2f22]/45">Pays suivis</span><strong className="moony-serif mt-1 block text-2xl font-normal">{data.countries.length}</strong></div></div></article> : <article className="admin-card admin-shadow grid min-h-[300px] place-items-center p-8 text-center"><div><BarChart3 size={34} className="mx-auto text-[#9d4c27]/40"/><h2 className="moony-serif mt-4 text-2xl">Votre espace de travail</h2><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#5b2f22]/45">Les indicateurs affichés ici sont limités à votre périmètre métier. Utilisez les raccourcis ci-dessus pour accéder directement à vos outils.</p></div></article>}
      </div>

      {has("analytics.read") && data.countries.length ? <div className="mt-4"><article className="admin-card admin-shadow p-5"><div className="flex items-center justify-between"><h2 className="moony-serif text-2xl">Audience par pays</h2><Link href="/admin/analytics" className="text-xs text-[#8d3b19]">Voir tout</Link></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.countries.map((item) => <div key={item.name}><div className="flex justify-between text-xs"><span>{item.name}</span><strong>{countryTotal ? Math.round(item.value / countryTotal * 100) : 0}%</strong></div><div className="mt-1 h-2 rounded-full bg-[#f2e6de]"><div className="h-2 rounded-full bg-[#9d4c27]" style={{ width: `${countryTotal ? item.value / countryTotal * 100 : 0}%` }}/></div></div>)}</div></article></div> : null}

      {has("crm.read") ? <div className="mt-4 grid gap-4 2xl:grid-cols-[1.45fr_.55fr]">
        <article className="admin-card admin-shadow p-4"><div className="mb-3 flex items-center justify-between"><h2 className="moony-serif text-2xl">Pipeline commercial</h2><Link href="/admin/crm" className="text-xs text-[#8d3b19]">Ouvrir le CRM →</Link></div><div className="flex gap-2 overflow-x-auto pb-2">{stages.map(([status,label],index) => { const rows = data.leads.filter((item) => item.status === status); const total = rows.reduce((sum,item) => sum + Number(item.deal_value || 0), 0); return <div key={status} className={`min-w-[180px] flex-1 rounded-xl p-3 ${index === 6 ? "bg-[#e4f3e8]" : index === 7 ? "bg-[#f8e4e2]" : index >= 3 ? "bg-[#fbf0dd]" : "bg-[#f7eee8]"}`}><p className="text-xs font-semibold">{label} <span className="font-normal text-[#5b2f22]/40">({rows.length})</span></p><strong className="moony-serif mt-1 block text-xl font-normal">{money(total)}</strong><div className="mt-3 space-y-2">{rows.slice(0,3).map((lead) => <Link href={`/admin/crm?lead=${lead.id}`} key={lead.id} className="block rounded-lg bg-white px-3 py-2 text-[11px] shadow-sm transition hover:-translate-y-[1px]"><strong className="block truncate">{lead.company || `${lead.first_name} ${lead.last_name}`}</strong><span className="text-[#5b2f22]/45">{lead.country || "Pays non renseigné"}</span></Link>)}</div></div>; })}</div></article>
        <article className="admin-card admin-shadow p-4"><div className="flex items-center justify-between"><div><h2 className="moony-serif text-2xl">Relances</h2><p className="mt-0.5 text-[10px] text-[#5b2f22]/42">{overdueTasks.length} en retard</p></div><Link href="/admin/crm" className="text-xs text-[#8d3b19]">CRM →</Link></div>{!data.tasksAvailable ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800">Appliquez la migration CRM pour activer les tâches commerciales.</div> : null}<div className="mt-4 space-y-2">{data.tasks.length ? data.tasks.slice(0,6).map((task) => { const lead = taskLead(task); const late = Boolean(task.due_at && new Date(task.due_at).getTime() < now); return <Link key={task.id} href={`/admin/crm?lead=${task.lead_id}`} className={`block rounded-xl border p-3 transition hover:bg-[#fffaf6] ${late ? "border-red-200 bg-red-50/45" : "border-[#5b2f22]/9 bg-white"}`}><div className="flex items-start gap-2">{late ? <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-500"/> : <Clock3 size={14} className="mt-0.5 shrink-0 text-[#9d4c27]"/>}<div className="min-w-0"><strong className="block truncate text-xs">{task.title}</strong><span className={`mt-1 block text-[10px] ${late ? "text-red-600" : "text-[#5b2f22]/42"}`}>{taskDate(task.due_at)}</span><span className="mt-1 block truncate text-[10px] text-[#5b2f22]/42">{lead?.company || lead ? `${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`.trim() : "Prospect"}</span></div></div></Link>; }) : <div className="py-8 text-center"><CheckCircle2 size={28} className="mx-auto text-emerald-500/60"/><p className="mt-2 text-xs text-[#5b2f22]/42">Aucune relance ouverte.</p></div>}</div></article>
      </div> : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        {has("appointments.read") ? <article className="admin-card admin-shadow p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><CalendarClock size={17} className="text-[#9d4c27]"/><h3 className="moony-serif text-xl">Prochains rendez-vous</h3></div><Link href="/admin/rendez-vous" className="text-[10px] text-[#8d3b19]">Voir tous</Link></div><div className="mt-3 space-y-2">{data.upcomingAppointments.length ? data.upcomingAppointments.slice(0,4).map((item) => <Link href={item.lead_id ? `/admin/crm?lead=${item.lead_id}` : "/admin/rendez-vous"} key={item.id} className="block border-b border-[#5b2f22]/8 pb-2 text-[11px]"><strong className="block">{item.starts_at ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.starts_at)) : "Date à préciser"}</strong><span className="text-[#5b2f22]/45">{item.provider || item.notes || "Rendez-vous"}</span></Link>) : <p className="py-6 text-xs text-[#5b2f22]/40">Aucun rendez-vous à venir.</p>}</div></article> : null}

        {has("support.read") ? <article className="admin-card admin-shadow p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><MessageSquareText size={17} className="text-[#9d4c27]"/><h3 className="moony-serif text-xl">Service client</h3></div><Link href="/admin/service-client" className="text-[10px] text-[#8d3b19]">Ouvrir</Link></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-[#f7eee8] p-3 text-center"><strong className="moony-serif block text-2xl font-normal">{data.supportSummary.open}</strong><span className="text-[10px] text-[#5b2f22]/45">ouverts</span></div><div className="rounded-lg bg-red-50 p-3 text-center"><strong className="moony-serif block text-2xl font-normal text-red-700">{data.supportSummary.urgent}</strong><span className="text-[10px] text-red-600/70">urgents</span></div></div><div className="mt-3 space-y-2">{data.tickets.slice(0,3).map((item) => <Link href={`/admin/service-client?ticket=${item.id}`} key={item.id} className="block border-b border-[#5b2f22]/8 pb-2 text-[11px]"><strong className="block truncate">{item.subject}</strong><span className="text-[#5b2f22]/45">{item.requester_name || item.requester_email} · {item.status}</span></Link>)}</div></article> : null}

        {has("marketing.read") ? <article className="admin-card admin-shadow p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Megaphone size={17} className="text-[#9d4c27]"/><h3 className="moony-serif text-xl">Marketing</h3></div><Link href="/admin/marketing" className="text-[10px] text-[#8d3b19]">Gérer</Link></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-[#f7eee8] p-3 text-center"><strong className="moony-serif block text-2xl font-normal">{data.marketingSummary.activeElements}</strong><span className="text-[10px] text-[#5b2f22]/45">activations actives</span></div><div className="rounded-lg bg-[#fbf0dd] p-3 text-center"><strong className="moony-serif block text-2xl font-normal">{data.marketingSummary.campaignsScheduled}</strong><span className="text-[10px] text-[#5b2f22]/45">campagnes prévues</span></div></div><div className="mt-3 space-y-2">{data.campaigns.slice(0,3).map((item) => <Link href="/admin/newsletters" key={item.id} className="block border-b border-[#5b2f22]/8 pb-2 text-[11px]"><strong className="block truncate">{item.name}</strong><span className="text-[#5b2f22]/45">{item.status}</span></Link>)}{!data.campaigns.length ? <p className="py-4 text-xs text-[#5b2f22]/40">Aucune campagne.</p> : null}</div></article> : null}

        {(has("site.read") || has("content.read")) ? <article className="admin-card admin-shadow p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><FileText size={17} className="text-[#9d4c27]"/><h3 className="moony-serif text-xl">Publication</h3></div><Link href={has("site.read") ? "/admin/pages" : "/admin/articles"} className="text-[10px] text-[#8d3b19]">Ouvrir</Link></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-[#f7eee8] p-2"><strong className="moony-serif block text-2xl font-normal">{data.contentSummary.pagesDraft}</strong><span className="text-[9px] text-[#5b2f22]/45">pages brouillon</span></div><div className="rounded-lg bg-[#f7eee8] p-2"><strong className="moony-serif block text-2xl font-normal">{data.contentSummary.articlesDraft}</strong><span className="text-[9px] text-[#5b2f22]/45">articles à finir</span></div><div className="rounded-lg bg-[#f7eee8] p-2"><strong className="moony-serif block text-2xl font-normal">{data.contentSummary.resourcesDraft}</strong><span className="text-[9px] text-[#5b2f22]/45">ressources</span></div></div><div className="mt-3 space-y-2">{[...data.pages, ...data.articles, ...data.resources].sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0,3).map((item) => <div key={`${item.id}-${item.slug}`} className="flex items-center justify-between border-b border-[#5b2f22]/8 pb-2 text-[11px]"><span className="truncate pr-3">{item.title}</span><span className="shrink-0 text-[9px] text-[#5b2f22]/40">{shortDate(item.updated_at)}</span></div>)}</div></article> : null}
      </div>

      {has("team.manage") ? <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="admin-card admin-shadow p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><UsersRound size={18} className="text-[#9d4c27]"/><h2 className="moony-serif text-2xl">Équipe & sécurité</h2></div><Link href="/admin/equipe" className="text-xs text-[#8d3b19]">Gérer →</Link></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-[#fbf4ee] p-3"><strong className="moony-serif block text-3xl font-normal">{data.teamSummary.active}</strong><span className="text-[10px] text-[#5b2f22]/45">membres actifs</span></div><div className="rounded-xl bg-[#fbf4ee] p-3"><strong className="moony-serif block text-3xl font-normal">{data.teamSummary.activeSessions}</strong><span className="text-[10px] text-[#5b2f22]/45">sessions actives</span></div><div className={`rounded-xl p-3 ${data.teamSummary.withoutMfa ? "bg-amber-50" : "bg-emerald-50"}`}><strong className="moony-serif block text-3xl font-normal">{data.teamSummary.withoutMfa}</strong><span className="text-[10px] text-[#5b2f22]/45">sans 2FA</span></div><div className={`rounded-xl p-3 ${data.teamSummary.mustChangePassword ? "bg-amber-50" : "bg-emerald-50"}`}><strong className="moony-serif block text-3xl font-normal">{data.teamSummary.mustChangePassword}</strong><span className="text-[10px] text-[#5b2f22]/45">mdp temporaires</span></div></div></article>
        <article className="admin-card admin-shadow p-5"><div className="flex items-center gap-2"><KeyRound size={18} className="text-[#9d4c27]"/><h2 className="moony-serif text-2xl">État du Control Center</h2></div><div className="mt-4 space-y-3 text-xs"><div className="flex items-center justify-between rounded-xl border border-[#5b2f22]/8 px-4 py-3"><span>Contrôle d’accès par rôle</span><span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={13}/>Actif</span></div><div className="flex items-center justify-between rounded-xl border border-[#5b2f22]/8 px-4 py-3"><span>Journal des actions sensibles</span><Link href="/admin/journal-activite" className="text-[#8d3b19]">Consulter →</Link></div><div className="flex items-center justify-between rounded-xl border border-[#5b2f22]/8 px-4 py-3"><span>Mes appareils connectés</span><Link href="/admin/mon-compte" className="text-[#8d3b19]">Sécurité →</Link></div></div></article>
      </div> : null}
    </AdminShell>
  );
}
