"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  FileText,
  Headphones,
  ListTodo,
  Mail,
  Megaphone,
  RefreshCw,
  UserPlus,
  X,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";

type NotificationKind = "task" | "lead" | "ticket" | "appointment" | "campaign" | "content";
type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  subtitle: string;
  href: string;
  severity: "info" | "warning" | "urgent";
  dueAt?: string | null;
  createdAt?: string | null;
  read?: boolean;
};
type ActivityItem = {
  id: string;
  createdAt: string;
  actor: string;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  module: string;
  href: string;
};

const notificationIcons = {
  task: ListTodo,
  lead: UserPlus,
  ticket: Headphones,
  appointment: CalendarClock,
  campaign: Mail,
  content: FileText,
};

const moduleLabels: Record<string, string> = {
  crm: "CRM",
  support: "Support",
  appointments: "Rendez-vous",
  marketing: "Marketing",
  site: "Site & CMS",
  content: "Contenu",
  seo: "SEO",
  settings: "Paramètres",
  team: "Équipe & sécurité",
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function ActivityCenterPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stateAvailable, setStateAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"alerts" | "activity">("alerts");
  const [filter, setFilter] = useState<"all" | "unread" | "urgent">("all");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [notificationResponse, activityResponse] = await Promise.all([
        fetch("/api/admin/notifications", { cache: "no-store" }),
        fetch("/api/admin/activity?limit=120", { cache: "no-store" }),
      ]);
      if (notificationResponse.status === 401 || activityResponse.status === 401) { location.href = "/admin/login"; return; }
      const notificationPayload = await notificationResponse.json().catch(() => ({}));
      const activityPayload = await activityResponse.json().catch(() => ({}));
      if (notificationResponse.ok) {
        setNotifications(notificationPayload.items ?? []);
        setUnreadCount(notificationPayload.unreadCount ?? 0);
        setStateAvailable(notificationPayload.stateAvailable ?? true);
      }
      if (activityResponse.ok) setActivities(activityPayload.items ?? []);
      if (!notificationResponse.ok || !activityResponse.ok) setMessage(notificationPayload.error || activityPayload.error || "Certaines données n’ont pas pu être chargées.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const visibleNotifications = useMemo(() => notifications.filter((item) => {
    if (filter === "unread") return !item.read;
    if (filter === "urgent") return item.severity === "urgent" || item.severity === "warning";
    return true;
  }), [notifications, filter]);

  async function updateState(action: "read" | "unread" | "dismiss", ids: string[]) {
    if (!ids.length) return;
    setBusy(`${action}:${ids.join(",")}`);
    setMessage("");
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error ?? "Impossible de mettre à jour la notification."); return; }
      await load();
    } finally { setBusy(""); }
  }

  return (
    <AdminShell active="Centre d’activité">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#9d4c27]">Control Center</p>
          <h1 className="moony-serif mt-1 text-4xl tracking-[-.035em] text-[#5b2f22]">Centre d’activité</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b2f22]/52">Retrouvez ce qui demande votre attention et l’historique opérationnel correspondant à vos droits.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm text-[#5b2f22] disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Actualiser</button>
      </div>

      {message ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">{message}</div> : null}
      {!stateAvailable ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Appliquez la migration Supabase des notifications pour conserver l’état lu/non lu entre les sessions.</div> : null}

      <div className="mt-6 inline-flex rounded-xl border border-[#5b2f22]/10 bg-white p-1 shadow-sm">
        <button onClick={() => setTab("alerts")} className={`rounded-lg px-4 py-2 text-xs font-medium ${tab === "alerts" ? "bg-[#7e3518] text-white" : "text-[#5b2f22]/65"}`}>Alertes {unreadCount ? `(${unreadCount})` : ""}</button>
        <button onClick={() => setTab("activity")} className={`rounded-lg px-4 py-2 text-xs font-medium ${tab === "activity" ? "bg-[#7e3518] text-white" : "text-[#5b2f22]/65"}`}>Historique opérationnel</button>
      </div>

      {tab === "alerts" ? (
        <section className="mt-4 admin-card admin-shadow overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#5b2f22]/8 px-4 py-3">
            <div className="mr-auto flex items-center gap-2"><Bell size={17} className="text-[#9d4c27]"/><strong className="text-sm">Notifications opérationnelles</strong></div>
            {(["all", "unread", "urgent"] as const).map((value) => <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-[10px] ${filter === value ? "bg-[#ead1bf] font-semibold text-[#6f2d17]" : "bg-[#f8f3ee] text-[#5b2f22]/55"}`}>{value === "all" ? "Toutes" : value === "unread" ? "Non lues" : "Prioritaires"}</button>)}
            {unreadCount && stateAvailable ? <button onClick={() => void updateState("read", notifications.filter((item) => !item.read).map((item) => item.id))} className="rounded-full border border-[#5b2f22]/10 px-3 py-1.5 text-[10px] text-[#7e3518]">Tout marquer lu</button> : null}
          </div>

          <div className="divide-y divide-[#5b2f22]/7">
            {loading && !notifications.length ? <div className="py-16 text-center text-xs text-[#5b2f22]/42">Chargement…</div> : visibleNotifications.length ? visibleNotifications.map((item) => {
              const Icon = notificationIcons[item.kind];
              const pending = busy.includes(item.id);
              return <div key={item.id} className={`grid gap-3 px-4 py-4 sm:grid-cols-[40px_1fr_auto] ${item.read ? "bg-white" : "bg-[#fff9f4]"}`}>
                <span className={`grid h-9 w-9 place-items-center rounded-full ${item.severity === "urgent" ? "bg-red-100 text-red-600" : item.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-[#efe0d5] text-[#8d3b19]"}`}><Icon size={16}/></span>
                <div className="min-w-0"><div className="flex items-center gap-2"><strong className="truncate text-sm">{item.title}</strong>{!item.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#9d4c27]"/> : null}</div><p className="mt-1 text-xs leading-5 text-[#5b2f22]/50">{item.subtitle}</p><p className="mt-1 text-[10px] text-[#8d3b19]">{formatDate(item.dueAt || item.createdAt)}</p></div>
                <div className="flex items-center gap-1 sm:justify-end">
                  <Link href={item.href} onClick={() => { if (!item.read && stateAvailable) void updateState("read", [item.id]); }} className="rounded-lg bg-[#7e3518] px-3 py-2 text-[10px] font-medium text-white">Ouvrir</Link>
                  {stateAvailable ? <button onClick={() => void updateState(item.read ? "unread" : "read", [item.id])} disabled={pending} className="rounded-lg border border-[#5b2f22]/10 p-2 text-[#7e3518]" title={item.read ? "Marquer non lue" : "Marquer lue"}><Check size={13}/></button> : null}
                  {stateAvailable ? <button onClick={() => void updateState("dismiss", [item.id])} disabled={pending} className="rounded-lg border border-[#5b2f22]/10 p-2 text-[#5b2f22]/45" title="Masquer"><X size={13}/></button> : null}
                </div>
              </div>;
            }) : <div className="py-16 text-center"><CheckCircle2 size={32} className="mx-auto text-emerald-500/60"/><p className="mt-2 text-sm font-medium">Aucune alerte dans ce filtre.</p><p className="mt-1 text-xs text-[#5b2f22]/42">Les nouvelles priorités apparaîtront ici automatiquement.</p></div>}
          </div>
        </section>
      ) : (
        <section className="mt-4 admin-card admin-shadow overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[#5b2f22]/8 px-4 py-3"><Activity size={17} className="text-[#9d4c27]"/><strong className="text-sm">Historique opérationnel</strong><span className="ml-auto text-[10px] text-[#5b2f22]/40">{activities.length} événements visibles</span></div>
          <div className="divide-y divide-[#5b2f22]/7">{activities.length ? activities.map((item) => <Link href={item.href} key={item.id} className="grid gap-3 px-4 py-4 transition hover:bg-[#fff9f4] sm:grid-cols-[34px_1fr_auto]"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#f3e6dd] text-[#8d3b19]"><Activity size={14}/></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{item.summary}</strong><span className="rounded-full bg-[#f7eee8] px-2 py-1 text-[9px] text-[#7e3518]">{moduleLabels[item.module] || item.module}</span></div><p className="mt-1 text-[10px] text-[#5b2f22]/45">{item.actor}{item.actorRole ? ` · ${item.actorRole}` : ""}</p></div><time className="text-[10px] text-[#5b2f22]/42">{formatDate(item.createdAt)}</time></Link>) : <div className="py-16 text-center"><AlertCircle size={30} className="mx-auto text-[#9d4c27]/45"/><p className="mt-2 text-xs text-[#5b2f22]/45">Aucune activité disponible pour vos permissions.</p></div>}</div>
        </section>
      )}
    </AdminShell>
  );
}
