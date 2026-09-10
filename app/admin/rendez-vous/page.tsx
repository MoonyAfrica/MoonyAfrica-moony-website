"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, ExternalLink, Loader2, Plus, Trash2, UserRound, Video } from "lucide-react";
import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
type Lead = { id: string; first_name: string; last_name: string; email: string; company: string | null; assigned_to: string | null; status: string };
type Appointment = {
  id: string;
  created_at: string;
  lead_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  provider: string | null;
  status: AppointmentStatus;
  meeting_url: string | null;
  notes: string | null;
  website_leads?: Lead | Lead[] | null;
};

const demoLead: Lead = { id: "lead-demo", first_name: "Awa", last_name: "Diop", email: "awa@example.com", company: "Hope Clinic", assigned_to: "M. Koné", status: "appointment" };
const demo: Appointment[] = [{ id: "demo-rdv", created_at: new Date().toISOString(), lead_id: demoLead.id, starts_at: new Date(Date.now() + 86400000).toISOString(), ends_at: new Date(Date.now() + 90000000).toISOString(), provider: "Calendly", status: "confirmed", meeting_url: null, notes: "Rendez-vous découverte", website_leads: demoLead }];
const labels: Record<AppointmentStatus, string> = { pending: "En attente", confirmed: "Confirmé", completed: "Terminé", cancelled: "Annulé", no_show: "Absent" };

function leadOf(item: Appointment) {
  const relation = item.website_leads;
  return Array.isArray(relation) ? relation[0] : relation ?? null;
}

function dateParts(value: string | null) {
  if (!value) return { date: "—", time: "—" };
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>(demo);
  const [leads, setLeads] = useState<Lead[]>([demoLead]);
  const [selectedId, setSelectedId] = useState(demo[0].id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [prefillLeadId, setPrefillLeadId] = useState("");

  const selected = useMemo(() => appointments.find((item) => item.id === selectedId), [appointments, selectedId]);
  const upcoming = appointments.filter((item) => item.starts_at && new Date(item.starts_at).getTime() >= Date.now() && !["cancelled", "completed"].includes(item.status));
  const confirmed = upcoming.filter((item) => item.status === "confirmed").length;
  const noShow = appointments.length ? (appointments.filter((item) => item.status === "no_show").length / appointments.length) * 100 : 0;
  const prefillLead = leads.find((lead) => lead.id === prefillLeadId) ?? null;

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/appointments", { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/admin/login"; return; }
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      const rows = (data.appointments ?? []) as Appointment[];
      const leadRows = (data.leads ?? []) as Lead[];
      setAppointments(rows);
      setLeads(leadRows);

      const requestedLeadId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("lead") : null;
      if (requestedLeadId && leadRows.some((lead) => lead.id === requestedLeadId)) {
        setPrefillLeadId(requestedLeadId);
        setCreating(true);
        const existing = rows.find((item) => item.lead_id === requestedLeadId && item.starts_at && new Date(item.starts_at).getTime() >= Date.now());
        if (existing) setSelectedId(existing.id);
      } else if (rows.length) {
        setSelectedId(rows[0].id);
      }
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  function openCreate(leadId = "") {
    setPrefillLeadId(leadId);
    setCreating(true);
  }

  function closeCreate() {
    setCreating(false);
    setPrefillLeadId("");
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("lead")) {
      window.history.replaceState({}, "", "/admin/rendez-vous");
    }
  }

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const starts = String(form.get("startsAt") || "");
    const duration = Number(form.get("duration") || 60);
    const startDate = new Date(starts);
    if (!starts || Number.isNaN(startDate.getTime())) { setNotice("Choisissez une date et une heure valides."); return; }
    const payload = {
      leadId: form.get("leadId") || null,
      startsAt: startDate.toISOString(),
      endsAt: new Date(startDate.getTime() + duration * 60000).toISOString(),
      provider: form.get("provider"),
      status: form.get("status"),
      meetingUrl: form.get("meetingUrl"),
      notes: form.get("notes"),
    };
    setSaving(true);
    try {
      const response = await fetch("/api/admin/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (response.status === 401) { window.location.href = "/admin/login"; return; }
      if (!response.ok) throw new Error(data.error || "Création impossible.");
      setCreating(false);
      setPrefillLeadId("");
      if (typeof window !== "undefined") window.history.replaceState({}, "", "/admin/rendez-vous");
      await load();
      setNotice("Rendez-vous planifié, rattaché au CRM et ajouté à la timeline commerciale.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: AppointmentStatus) {
    if (!selected) return;
    if (selected.id.startsWith("demo-")) {
      setAppointments((current) => current.map((item) => item.id === selected.id ? { ...item, status } : item));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/appointments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, status }) });
      const data = await response.json();
      if (response.status === 401) { window.location.href = "/admin/login"; return; }
      if (!response.ok) throw new Error(data.error || "Mise à jour impossible.");
      setAppointments((current) => current.map((item) => item.id === selected.id ? { ...item, ...data.appointment } : item));
      setNotice("Statut mis à jour et synchronisé dans l’historique commercial.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected || selected.id.startsWith("demo-") || !window.confirm("Supprimer ce rendez-vous ?")) return;
    const response = await fetch(`/api/admin/appointments?id=${encodeURIComponent(selected.id)}`, { method: "DELETE" });
    if (response.status === 401) { window.location.href = "/admin/login"; return; }
    if (!response.ok) return;
    const next = appointments.filter((item) => item.id !== selected.id);
    setAppointments(next);
    setSelectedId(next[0]?.id ?? "");
    setNotice("Rendez-vous supprimé et action ajoutée à la timeline du prospect.");
  }

  return (
    <AdminWorkspace
      active="Rendez-vous"
      title="Rendez-vous"
      subtitle="Centralisez les rendez-vous issus du site, de Calendly et de WhatsApp, puis rattachez-les au CRM."
      actions={<button onClick={() => openCreate()} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white"><Plus size={15} /> Planifier un rendez-vous</button>}
    >
      {!connected && !loading ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><span>Mode aperçu. Connectez le Control Center pour charger les vrais rendez-vous.</span><Link href="/admin/login" className="font-semibold underline">Se connecter</Link></div> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "À venir", value: String(upcoming.length), note: "rendez-vous planifiés" },
          { label: "Confirmés", value: String(confirmed), note: "rendez-vous à venir" },
          { label: "No-show", value: `${noShow.toFixed(1)}%`, note: "sur les rendez-vous enregistrés" },
        ].map((card) => <div key={card.label} className="admin-card admin-shadow p-5"><p className="text-xs text-[#5b2f22]/45">{card.label}</p><p className="moony-serif mt-2 text-5xl">{card.value}</p><p className="mt-2 text-xs text-[#5b2f22]/45">{card.note}</p></div>)}
      </div>

      <div className="mt-4 grid gap-4 2xl:grid-cols-[1fr_360px]">
        <AdminCard title="Agenda commercial" action={<span className="text-xs text-[#5b2f22]/40">{loading ? "Chargement…" : `${appointments.length} rendez-vous`}</span>}>
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="text-[#5b2f22]/45"><tr>{["Date", "Heure", "Entreprise", "Contact", "Source", "Statut", "Responsable"].map((heading) => <th key={heading} className="pb-3">{heading}</th>)}</tr></thead><tbody>{appointments.map((item) => { const lead = leadOf(item); const when = dateParts(item.starts_at); return <tr key={item.id} onClick={() => setSelectedId(item.id)} className={`cursor-pointer border-t border-[#5b2f22]/8 transition hover:bg-[#fbf4ee] ${selectedId === item.id ? "bg-[#f9ece3]" : ""}`}><td className="py-3">{when.date}</td><td>{when.time}</td><td className="font-medium">{lead?.company || "—"}</td><td><strong className="block font-medium">{lead ? `${lead.first_name} ${lead.last_name}` : "Sans lead"}</strong><span className="text-[10px] text-[#5b2f22]/40">{lead?.email || ""}</span></td><td>{item.provider || "Control Center"}</td><td><span className={`rounded-full px-2 py-1 ${item.status === "confirmed" ? "bg-emerald-100 text-emerald-800" : item.status === "cancelled" || item.status === "no_show" ? "bg-red-100 text-red-700" : item.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800"}`}>{labels[item.status]}</span></td><td>{lead?.assigned_to || "—"}</td></tr>; })}</tbody></table></div>
        </AdminCard>

        {selected ? <AdminCard title="Détail du rendez-vous" action={selected.id.startsWith("demo-") ? null : <button onClick={remove} className="rounded-lg border border-red-200 p-2 text-red-700" aria-label="Supprimer"><Trash2 size={14} /></button>}><div className="space-y-4 text-sm">{(() => { const lead = leadOf(selected); const when = dateParts(selected.starts_at); return <><div className="rounded-xl bg-[#f8eee7] p-4"><p className="text-xs text-[#5b2f22]/45">Quand</p><p className="moony-serif mt-1 text-2xl">{when.date} · {when.time}</p></div><div><p className="text-xs text-[#5b2f22]/45">Contact</p><p className="mt-1 font-semibold">{lead ? `${lead.first_name} ${lead.last_name}` : "Non rattaché"}</p><p className="text-xs text-[#5b2f22]/50">{lead?.company || ""}</p>{selected.lead_id?<Link href={`/admin/crm?lead=${selected.lead_id}`} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8d3b19]"><UserRound size={12}/>Ouvrir la fiche CRM</Link>:null}</div><label className="block"><span className="mb-1 block text-xs text-[#5b2f22]/45">Statut</span><select value={selected.status} onChange={(event) => void updateStatus(event.target.value as AppointmentStatus)} disabled={saving} className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm"><option value="pending">En attente</option><option value="confirmed">Confirmé</option><option value="completed">Terminé</option><option value="cancelled">Annulé</option><option value="no_show">Absent</option></select></label>{selected.notes ? <div><p className="text-xs text-[#5b2f22]/45">Notes</p><p className="mt-1 text-xs leading-5 text-[#5b2f22]/65">{selected.notes}</p></div> : null}{selected.meeting_url ? <a href={selected.meeting_url} target="_blank" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7e3518] px-5 py-3 text-sm text-white"><Video size={15} /> Rejoindre le rendez-vous <ExternalLink size={13} /></a> : null}</>; })()}</div></AdminCard> : null}
      </div>

      {creating ? <div className="fixed inset-0 z-[80] grid place-items-center bg-[#2d1812]/30 p-4 backdrop-blur-sm"><form onSubmit={createAppointment} className="w-full max-w-xl rounded-[26px] bg-[#fffaf4] p-7 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[.22em] text-[#9d4c27]">Agenda commercial</p><h2 className="moony-serif mt-1 text-3xl">Planifier un rendez-vous</h2>{prefillLead?<p className="mt-1 text-xs text-[#5b2f22]/52">Pour {prefillLead.first_name} {prefillLead.last_name}{prefillLead.company?` · ${prefillLead.company}`:""}</p>:null}</div><button type="button" onClick={closeCreate} className="text-xs text-[#5b2f22]/45">Fermer</button></div><label className="mt-5 block"><span className="mb-1 block text-xs">Lead / prospect</span><select name="leadId" value={prefillLeadId} onChange={event=>setPrefillLeadId(event.target.value)} className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm"><option value="">Sans lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.first_name} {lead.last_name}{lead.company ? ` — ${lead.company}` : ""}</option>)}</select></label><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-1 block text-xs">Date et heure *</span><input name="startsAt" type="datetime-local" required className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label><label><span className="mb-1 block text-xs">Durée</span><select name="duration" defaultValue="60" className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm"><option value="30">30 min</option><option value="45">45 min</option><option value="60">1 heure</option><option value="90">1 h 30</option></select></label><label><span className="mb-1 block text-xs">Source</span><select name="provider" defaultValue="Control Center" className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm"><option>Control Center</option><option>Calendly</option><option>WhatsApp</option><option>Formulaire site</option></select></label><label><span className="mb-1 block text-xs">Statut</span><select name="status" defaultValue="pending" className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm"><option value="pending">En attente</option><option value="confirmed">Confirmé</option></select></label></div><label className="mt-4 block"><span className="mb-1 block text-xs">Lien visio / rendez-vous</span><input name="meetingUrl" className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" placeholder="https://…" /></label><label className="mt-4 block"><span className="mb-1 block text-xs">Notes</span><textarea name="notes" rows={3} className="w-full resize-none rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label><button disabled={saving} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7e3518] px-5 py-3.5 text-sm font-semibold text-white">{saving ? <Loader2 size={15} className="animate-spin" /> : <CalendarDays size={15} />} Planifier</button></form></div> : null}

      {notice ? <div className="fixed bottom-5 right-5 z-[90] max-w-sm rounded-xl bg-[#3d2119] px-4 py-3 text-sm text-white shadow-xl">{notice}</div> : null}
    </AdminWorkspace>
  );
}
