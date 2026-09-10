"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Mail, MessageSquareReply, Plus, Search, Send, UserRound } from "lucide-react";
import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
type Priority = "low" | "normal" | "high" | "urgent";
type TicketType = "question" | "request" | "incident" | "complaint" | "feedback";

type Ticket = {
  id: string;
  created_at: string;
  updated_at: string;
  requester_name: string | null;
  requester_email: string;
  type: TicketType;
  subject: string;
  message: string;
  priority: Priority;
  status: TicketStatus;
  assigned_to: string | null;
  metadata?: Record<string, unknown>;
};

type TicketMessage = {
  id: string;
  created_at: string;
  ticket_id: string;
  sender_kind: "requester" | "agent" | "system";
  sender_name: string | null;
  body: string;
};

const demoTickets: Ticket[] = [
  { id: "demo-1562", created_at: new Date(Date.now() - 2 * 3600_000).toISOString(), updated_at: new Date().toISOString(), requester_name: "Awa Traoré", requester_email: "awa@example.com", type: "request", subject: "Accès à la plateforme", message: "Bonjour, je souhaite être accompagnée pour accéder à mon espace.", priority: "high", status: "in_progress", assigned_to: "S. Lemoine" },
  { id: "demo-1561", created_at: new Date(Date.now() - 5 * 3600_000).toISOString(), updated_at: new Date().toISOString(), requester_name: "Fatou Bâ", requester_email: "fatou@example.com", type: "incident", subject: "Problème de paiement", message: "Mon paiement ne semble pas avoir été pris en compte.", priority: "urgent", status: "open", assigned_to: "A. Koné" },
];

const demoMessages: TicketMessage[] = demoTickets.map((ticket, index) => ({ id: `demo-message-${index}`, created_at: ticket.created_at, ticket_id: ticket.id, sender_kind: "requester", sender_name: ticket.requester_name, body: ticket.message }));
const statusLabels: Record<TicketStatus, string> = { open: "Ouvert", in_progress: "En cours", waiting: "En attente", resolved: "Résolu", closed: "Fermé" };
const priorityLabels: Record<Priority, string> = { low: "Basse", normal: "Moyenne", high: "Haute", urgent: "Urgente" };
const typeLabels: Record<TicketType, string> = { question: "Question", request: "Demande", incident: "Signalement", complaint: "Réclamation", feedback: "Avis" };

function relativeDate(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.max(0, Math.floor(diff / 3600_000));
  if (hours < 1) return "À l’instant";
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days} j`;
}

export default function ServiceClientPage() {
  const [tickets, setTickets] = useState<Ticket[]>(demoTickets);
  const [messages, setMessages] = useState<TicketMessage[]>(demoMessages);
  const [selectedId, setSelectedId] = useState(demoTickets[0].id);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [replying, setReplying] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = useMemo(() => tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0], [tickets, selectedId]);
  const conversation = useMemo(() => messages.filter((message) => message.ticket_id === selected?.id), [messages, selected?.id]);
  const filtered = useMemo(() => tickets.filter((ticket) => {
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || [ticket.subject, ticket.requester_name ?? "", ticket.requester_email, ticket.assigned_to ?? ""].some((value) => value.toLowerCase().includes(needle));
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [tickets, search, statusFilter]);

  const openCount = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;
  const highCount = tickets.filter((ticket) => ["high", "urgent"].includes(ticket.priority) && !["resolved", "closed"].includes(ticket.status)).length;
  const waitingCount = tickets.filter((ticket) => ticket.status === "waiting").length;
  const resolvedCount = tickets.filter((ticket) => ticket.status === "resolved").length;

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/support", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      const rows = (data.tickets ?? []) as Ticket[];
      setTickets(rows);
      setMessages((data.messages ?? []) as TicketMessage[]);
      if (rows.length) setSelectedId(rows[0].id);
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  async function patchTicket(patch: Partial<Ticket>) {
    if (!selected || selected.id.startsWith("demo-")) {
      setTickets((current) => current.map((ticket) => ticket.id === selected?.id ? { ...ticket, ...patch } : ticket));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/support", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, status: patch.status, priority: patch.priority, assignedTo: patch.assigned_to, subject: patch.subject, type: patch.type }) });
      const data = await response.json();
      if (response.status === 401) { window.location.href = "/admin/login"; return; }
      if (!response.ok) throw new Error(data.error || "Mise à jour impossible.");
      const updated = data.ticket as Ticket;
      setTickets((current) => current.map((ticket) => ticket.id === updated.id ? updated : ticket));
      setNotice("Ticket mis à jour.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    if (selected.id.startsWith("demo-")) {
      setMessages((current) => [...current, { id: `local-${Date.now()}`, created_at: new Date().toISOString(), ticket_id: selected.id, sender_kind: "agent", sender_name: "Équipe MOONY", body: reply.trim() }]);
      setReply("");
      return;
    }
    setReplying(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/support/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId: selected.id, message: reply, senderName: selected.assigned_to || "Équipe MOONY" }) });
      const data = await response.json();
      if (response.status === 401) { window.location.href = "/admin/login"; return; }
      if (!response.ok) throw new Error(data.error || "Réponse impossible.");
      setMessages((current) => [...current, data.message as TicketMessage]);
      setTickets((current) => current.map((ticket) => ticket.id === selected.id ? { ...ticket, status: "waiting", updated_at: new Date().toISOString() } : ticket));
      setReply("");
      setNotice(data.delivered ? "Réponse enregistrée et envoyée par e-mail." : "Réponse enregistrée. Configurez Brevo pour l’envoyer aussi par e-mail.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Réponse impossible.");
    } finally {
      setReplying(false);
    }
  }

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { name: form.get("name"), email: form.get("email"), type: form.get("type"), subject: form.get("subject"), message: form.get("message"), priority: form.get("priority"), assignedTo: form.get("assignedTo") };
    setSaving(true);
    try {
      const response = await fetch("/api/admin/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (response.status === 401) { window.location.href = "/admin/login"; return; }
      if (!response.ok) throw new Error(data.error || "Création impossible.");
      const ticket = data.ticket as Ticket;
      setTickets((current) => [ticket, ...current]);
      setSelectedId(ticket.id);
      setCreating(false);
      setNotice("Nouveau ticket créé.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminWorkspace
      active="Service client"
      title="Service client"
      subtitle="Une vraie boîte de réception pour les demandes, questions, réclamations et signalements reçus par MOONY."
      actions={<button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white"><Plus size={15} /> Nouveau ticket</button>}
    >
      {!connected && !loading ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><span>Mode aperçu. Connectez-vous pour lire et traiter les vraies demandes.</span><Link href="/admin/login" className="font-semibold underline">Se connecter</Link></div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["Tickets à traiter", String(openCount), MessageSquareReply], ["Priorité haute", String(highCount), Mail], ["En attente client", String(waitingCount), UserRound], ["Résolus", String(resolvedCount), CheckCircle2]].map(([label, value, Icon]) => <div key={String(label)} className="admin-card admin-shadow p-5"><div className="flex items-center justify-between"><p className="text-xs text-[#5b2f22]/45">{String(label)}</p><Icon size={17} className="text-[#9d4c27]" /></div><p className="moony-serif mt-2 text-4xl">{String(value)}</p></div>)}
      </div>

      <div className="mt-4 grid gap-4 2xl:grid-cols-[1fr_430px]">
        <AdminCard title="Boîte de réception" action={<span className="text-xs text-[#5b2f22]/45">{loading ? "Chargement…" : `${filtered.length} ticket(s)`}</span>}>
          <div className="mb-4 flex flex-wrap gap-2"><label className="flex min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5"><Search size={14} className="opacity-45" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un ticket…" className="w-full bg-transparent text-xs outline-none" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | TicketStatus)} className="rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5 text-xs"><option value="all">Tous les statuts</option><option value="open">Ouverts</option><option value="in_progress">En cours</option><option value="waiting">En attente</option><option value="resolved">Résolus</option><option value="closed">Fermés</option></select></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="text-[#5b2f22]/45"><tr><th className="pb-3">Type</th><th>Sujet</th><th>Client / Contact</th><th>Priorité</th><th>Statut</th><th>Assigné à</th><th>Activité</th></tr></thead><tbody>{filtered.map((ticket) => <tr key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={`cursor-pointer border-t border-[#5b2f22]/8 transition hover:bg-[#fbf4ee] ${selected?.id === ticket.id ? "bg-[#f9ece3]" : ""}`}><td className="py-3"><span className="rounded-full bg-[#f3e3d9] px-2 py-1">{typeLabels[ticket.type]}</span></td><td className="font-medium">{ticket.subject}</td><td><strong className="block font-medium">{ticket.requester_name || "—"}</strong><span className="text-[10px] text-[#5b2f22]/42">{ticket.requester_email}</span></td><td><span className={`rounded-full px-2 py-1 ${ticket.priority === "urgent" ? "bg-red-200 text-red-800" : ticket.priority === "high" ? "bg-red-100 text-red-700" : ticket.priority === "normal" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{priorityLabels[ticket.priority]}</span></td><td><span className="rounded-full bg-[#e8eefb] px-2 py-1 text-blue-700">{statusLabels[ticket.status]}</span></td><td>{ticket.assigned_to || "Non assigné"}</td><td>{relativeDate(ticket.updated_at)}</td></tr>)}</tbody></table></div>
        </AdminCard>

        {selected ? <div className="space-y-4"><AdminCard title="Fiche du ticket" action={<span className="text-[10px] text-[#5b2f22]/40">{selected.id.slice(0, 8)}</span>}><div className="space-y-4"><div><p className="text-xs text-[#5b2f22]/45">Demandeur</p><p className="mt-1 text-sm font-semibold">{selected.requester_name || "Sans nom"}</p><a href={`mailto:${selected.requester_email}`} className="text-xs text-[#8d3b19] underline">{selected.requester_email}</a></div><label className="block"><span className="mb-1 block text-xs text-[#5b2f22]/45">Statut</span><select value={selected.status} onChange={(event) => void patchTicket({ status: event.target.value as TicketStatus })} disabled={saving} className="w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5 text-xs"><option value="open">Ouvert</option><option value="in_progress">En cours</option><option value="waiting">En attente client</option><option value="resolved">Résolu</option><option value="closed">Fermé</option></select></label><label className="block"><span className="mb-1 block text-xs text-[#5b2f22]/45">Priorité</span><select value={selected.priority} onChange={(event) => void patchTicket({ priority: event.target.value as Priority })} disabled={saving} className="w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5 text-xs"><option value="low">Basse</option><option value="normal">Moyenne</option><option value="high">Haute</option><option value="urgent">Urgente</option></select></label><label className="block"><span className="mb-1 block text-xs text-[#5b2f22]/45">Responsable</span><input defaultValue={selected.assigned_to ?? ""} onBlur={(event) => void patchTicket({ assigned_to: event.target.value || null })} className="w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-xs" placeholder="Nom du responsable" /></label></div></AdminCard>

          <AdminCard title="Conversation"><div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">{conversation.length ? conversation.map((message) => <div key={message.id} className={`rounded-2xl p-4 text-xs leading-5 ${message.sender_kind === "agent" ? "ml-8 bg-[#f2dfd2]" : "mr-8 bg-[#f7f2ed]"}`}><div className="mb-1 flex items-center justify-between gap-3"><strong>{message.sender_name || (message.sender_kind === "agent" ? "Équipe MOONY" : selected.requester_name || "Demandeur")}</strong><span className="text-[9px] text-[#5b2f22]/35">{relativeDate(message.created_at)}</span></div><p className="whitespace-pre-wrap text-[#5b2f22]/72">{message.body}</p></div>) : <p className="text-xs text-[#5b2f22]/45">Aucun message pour le moment.</p>}</div><form onSubmit={sendReply} className="mt-4 border-t border-[#5b2f22]/10 pt-4"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} placeholder="Rédiger une réponse…" className="w-full resize-none rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm outline-none focus:border-[#9d4c27]/50" /><button disabled={replying || !reply.trim()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7e3518] px-5 py-3 text-sm font-medium text-white disabled:opacity-45">{replying ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Répondre</button></form></AdminCard></div> : null}
      </div>

      {creating ? <div className="fixed inset-0 z-[80] grid place-items-center bg-[#2d1812]/30 p-4 backdrop-blur-sm"><form onSubmit={createTicket} className="w-full max-w-xl rounded-[26px] bg-[#fffaf4] p-7 shadow-2xl"><div className="flex items-center justify-between"><h2 className="moony-serif text-3xl">Nouveau ticket</h2><button type="button" onClick={() => setCreating(false)} className="text-sm text-[#5b2f22]/45">Fermer</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label><span className="mb-1 block text-xs">Nom</span><input name="name" className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label><label><span className="mb-1 block text-xs">E-mail *</span><input name="email" type="email" required className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label><label><span className="mb-1 block text-xs">Type</span><select name="type" className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm"><option value="request">Demande</option><option value="question">Question</option><option value="incident">Signalement</option><option value="complaint">Réclamation</option><option value="feedback">Avis</option></select></label><label><span className="mb-1 block text-xs">Priorité</span><select name="priority" className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm"><option value="normal">Moyenne</option><option value="low">Basse</option><option value="high">Haute</option><option value="urgent">Urgente</option></select></label></div><label className="mt-4 block"><span className="mb-1 block text-xs">Sujet *</span><input name="subject" required className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label><label className="mt-4 block"><span className="mb-1 block text-xs">Message *</span><textarea name="message" required rows={5} className="w-full resize-none rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label><label className="mt-4 block"><span className="mb-1 block text-xs">Assigné à</span><input name="assignedTo" className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" placeholder="Équipe MOONY" /></label><button disabled={saving} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7e3518] px-5 py-3.5 text-sm font-semibold text-white">{saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Créer le ticket</button></form></div> : null}

      {notice ? <div className="fixed bottom-5 right-5 z-[90] max-w-sm rounded-xl bg-[#3d2119] px-4 py-3 text-sm text-white shadow-xl">{notice}</div> : null}
    </AdminWorkspace>
  );
}
