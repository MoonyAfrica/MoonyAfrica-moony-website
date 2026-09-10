"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Mail, Plus, Save, Send, Trash2, Users } from "lucide-react";
import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused" | "cancelled";
type CampaignContent = { headline?: string; body?: string; ctaLabel?: string; ctaUrl?: string; html?: string };
type Campaign = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  status: CampaignStatus;
  audience: string;
  sender_name: string;
  sender_email: string | null;
  content: CampaignContent;
  scheduled_at: string | null;
  sent_at: string | null;
  provider: string | null;
  provider_campaign_id: string | null;
  stats: Record<string, number>;
  updated_at?: string;
};

const demo: Campaign = {
  id: "demo",
  name: "Santé des femmes : ensemble pour demain",
  subject: "Des ressources pensées pour vous ✨",
  preheader: "Les nouveautés MOONY de ce mois-ci.",
  status: "draft",
  audience: "all",
  sender_name: "MOONY Africa",
  sender_email: "contact@moonyafrica.com",
  content: { headline: "Des femmes plus sereines, pour un monde plus lumineux.", body: "Conseils, ressources et nouveautés : retrouvez ce que MOONY a préparé pour vous.", ctaLabel: "Découvrir les ressources", ctaUrl: "/ressources" },
  scheduled_at: null,
  sent_at: null,
  provider: null,
  provider_campaign_id: null,
  stats: {},
};

function blankCampaign(): Campaign {
  return { ...demo, id: "", name: "Nouvelle newsletter", subject: "", preheader: "", status: "draft", content: { headline: "Votre titre", body: "Écrivez ici votre message.", ctaLabel: "Découvrir", ctaUrl: "/" }, stats: {} };
}

const statusLabel: Record<CampaignStatus, string> = { draft: "Brouillon", scheduled: "Programmée", sending: "Envoi…", sent: "Envoyée", paused: "En pause", cancelled: "Annulée" };

export default function NewslettersPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([demo]);
  const [draft, setDraft] = useState<Campaign>(demo);
  const [selectedId, setSelectedId] = useState(demo.id);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState("");

  const selected = useMemo(() => campaigns.find((campaign) => campaign.id === selectedId), [campaigns, selectedId]);
  const sentCampaigns = campaigns.filter((campaign) => campaign.status === "sent");
  const avgOpen = sentCampaigns.length ? sentCampaigns.reduce((sum, item) => sum + Number(item.stats?.open_rate ?? 0), 0) / sentCampaigns.length : 0;
  const avgClick = sentCampaigns.length ? sentCampaigns.reduce((sum, item) => sum + Number(item.stats?.click_rate ?? 0), 0) / sentCampaigns.length : 0;

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (selected) setDraft(structuredClone(selected)); }, [selectedId]);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/newsletters", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      const rows = (data.campaigns ?? []) as Campaign[];
      setSubscriberCount(data.subscriberCount ?? 0);
      if (rows.length) {
        setCampaigns(rows);
        setSelectedId(rows[0].id);
        setDraft(structuredClone(rows[0]));
      }
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  function setContent(key: keyof CampaignContent, value: string) {
    setDraft((current) => ({ ...current, content: { ...current.content, [key]: value } }));
  }

  async function save() {
    setSaving(true);
    setNotice("");
    try {
      const payload = { id: draft.id, name: draft.name, subject: draft.subject, preheader: draft.preheader, status: draft.status, audience: draft.audience, senderName: draft.sender_name, senderEmail: draft.sender_email, content: draft.content, scheduledAt: draft.scheduled_at };
      const response = await fetch("/api/admin/newsletters", { method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (response.status === 401) { window.location.href = "/admin/login"; return; }
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
      const saved = data.campaign as Campaign;
      setCampaigns((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setSelectedId(saved.id);
      setDraft(saved);
      setConnected(true);
      setNotice("Newsletter enregistrée.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function sendNow() {
    if (!draft.id || draft.id === "demo") {
      setNotice("Enregistrez d’abord la newsletter avant de l’envoyer.");
      return;
    }
    if (!window.confirm(`Envoyer maintenant « ${draft.name} » aux destinataires sélectionnés ?`)) return;
    setSending(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/newsletters/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: draft.id }) });
      const data = await response.json();
      if (response.status === 401) { window.location.href = "/admin/login"; return; }
      if (!response.ok) throw new Error(data.error || "Envoi impossible.");
      const sent = data.campaign as Campaign;
      setCampaigns((current) => current.map((item) => item.id === sent.id ? sent : item));
      setDraft(sent);
      setNotice("Newsletter envoyée via Brevo.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  }

  function newCampaign() {
    setSelectedId("");
    setDraft(blankCampaign());
    setNotice("");
  }

  function duplicate() {
    setSelectedId("");
    setDraft({ ...draft, id: "", name: `${draft.name} — copie`, status: "draft", sent_at: null, provider: null, provider_campaign_id: null, stats: {} });
    setNotice("Copie créée en brouillon. Enregistrez-la pour la conserver.");
  }

  async function remove() {
    if (!draft.id || draft.id === "demo" || !window.confirm(`Supprimer « ${draft.name} » ?`)) return;
    const response = await fetch(`/api/admin/newsletters?id=${encodeURIComponent(draft.id)}`, { method: "DELETE" });
    if (response.status === 401) { window.location.href = "/admin/login"; return; }
    if (!response.ok) return;
    const next = campaigns.filter((item) => item.id !== draft.id);
    setCampaigns(next);
    setSelectedId(next[0]?.id ?? "");
    setDraft(next[0] ? structuredClone(next[0]) : blankCampaign());
  }

  return (
    <AdminWorkspace
      active="Newsletters"
      title="Newsletters"
      subtitle="Créez vos campagnes, gérez vos abonnés et déclenchez les envois Brevo depuis le Control Center."
      actions={<button onClick={newCampaign} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white"><Plus size={15} /> Créer une newsletter</button>}
    >
      {!connected && !loading ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><span>Mode aperçu. Connectez-vous et configurez Supabase pour enregistrer les campagnes.</span><Link href="/admin/login" className="font-semibold underline">Se connecter</Link></div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Abonnés actifs", subscriberCount ? subscriberCount.toLocaleString("fr-FR") : "—", Users],
          ["Campagnes envoyées", String(sentCampaigns.length), Send],
          ["Taux d’ouverture moyen", avgOpen ? `${avgOpen.toFixed(1)}%` : "—", Mail],
          ["Taux de clic moyen", avgClick ? `${avgClick.toFixed(1)}%` : "—", Mail],
        ].map(([label, value, Icon]) => <div key={String(label)} className="admin-card admin-shadow p-5"><div className="flex items-center justify-between"><p className="text-xs text-[#5b2f22]/45">{String(label)}</p><Icon size={16} className="text-[#9d4c27]" /></div><p className="moony-serif mt-2 text-4xl">{String(value)}</p></div>)}
      </div>

      <div className="mt-4 grid gap-4 2xl:grid-cols-[320px_1fr_360px]">
        <AdminCard title="Campagnes" action={<span className="text-[10px] text-[#5b2f22]/40">{loading ? "…" : campaigns.length}</span>}>
          <div className="space-y-2">{campaigns.map((campaign) => <button key={campaign.id} onClick={() => setSelectedId(campaign.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === campaign.id ? "border-[#b96d48]/40 bg-[#f9ece3]" : "border-[#5b2f22]/8 bg-white"}`}><div className="flex items-start justify-between gap-3"><strong className="text-xs leading-5">{campaign.name}</strong><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] ${campaign.status === "sent" ? "bg-emerald-100 text-emerald-700" : campaign.status === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-[#f2e5dc] text-[#6d4638]"}`}>{statusLabel[campaign.status]}</span></div><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#5b2f22]/45">{campaign.subject}</p></button>)}</div>
        </AdminCard>

        <AdminCard title="Éditeur d’e-mail" action={<div className="flex gap-2"><button onClick={duplicate} className="rounded-lg border border-[#5b2f22]/10 p-2" title="Dupliquer"><Copy size={14} /></button>{draft.id && draft.id !== "demo" ? <button onClick={remove} className="rounded-lg border border-red-200 p-2 text-red-700" title="Supprimer"><Trash2 size={14} /></button> : null}</div>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="mb-1.5 block text-xs font-semibold">Nom de campagne</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label>
            <label><span className="mb-1.5 block text-xs font-semibold">Objet</span><input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" placeholder="Objet visible dans la boîte mail" /></label>
          </div>
          <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold">Pré-header</span><input value={draft.preheader ?? ""} onChange={(event) => setDraft({ ...draft, preheader: event.target.value })} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label>
          <div className="mt-5 rounded-[22px] border border-[#5b2f22]/10 bg-[#f8efe7] p-5">
            <div className="mx-auto max-w-xl overflow-hidden rounded-xl bg-[#fffaf4] shadow-sm">
              <div className="border-b border-[#5b2f22]/8 px-6 py-4 text-center moony-serif text-2xl">MOONY</div>
              <div className="bg-[linear-gradient(135deg,#d59a72,#a65d3b)] p-7 text-white sm:p-9"><textarea value={draft.content.headline ?? ""} onChange={(event) => setContent("headline", event.target.value)} rows={3} className="moony-serif w-full resize-none bg-transparent text-4xl leading-[1.04] text-white outline-none placeholder:text-white/40" /><textarea value={draft.content.body ?? ""} onChange={(event) => setContent("body", event.target.value)} rows={4} className="mt-4 w-full resize-none bg-white/0 text-sm leading-6 text-white/85 outline-none" /><div className="mt-5 grid gap-2 sm:grid-cols-[1fr_1.2fr]"><input value={draft.content.ctaLabel ?? ""} onChange={(event) => setContent("ctaLabel", event.target.value)} className="rounded-full bg-[#7e3518] px-4 py-3 text-center text-xs text-white outline-none" /><input value={draft.content.ctaUrl ?? ""} onChange={(event) => setContent("ctaUrl", event.target.value)} className="rounded-full border border-white/35 bg-white/10 px-4 py-3 text-xs text-white outline-none placeholder:text-white/45" placeholder="https://…" /></div></div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3"><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[#7e3518] px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer</button></div>
        </AdminCard>

        <AdminCard title="Envoi & destinataires">
          <div className="space-y-4">
            <label className="block"><span className="mb-1.5 block text-xs font-semibold">Audience</span><select value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value })} className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm"><option value="all">Toutes les abonnées</option><option value="leads">Prospects / leads</option><option value="professionals">Professionnels</option><option value="companies">Entreprises</option></select></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold">Nom expéditeur</span><input value={draft.sender_name} onChange={(event) => setDraft({ ...draft, sender_name: event.target.value })} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold">E-mail expéditeur</span><input value={draft.sender_email ?? ""} onChange={(event) => setDraft({ ...draft, sender_email: event.target.value })} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold">Date de programmation</span><input type="datetime-local" value={draft.scheduled_at ? draft.scheduled_at.slice(0, 16) : ""} onChange={(event) => setDraft({ ...draft, scheduled_at: event.target.value ? new Date(event.target.value).toISOString() : null, status: event.target.value ? "scheduled" : draft.status })} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label>
            <div className="rounded-xl bg-[#f8eee7] p-4 text-xs leading-5 text-[#5b2f22]/60"><strong className="block text-[#5b2f22]">Brevo</strong>L’envoi immédiat utilise votre clé Brevo et la liste configurée dans les variables d’environnement. Les brouillons restent dans le Control Center tant que vous ne cliquez pas sur Envoyer.</div>
            <button onClick={sendNow} disabled={sending || draft.status === "sent"} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#3d2119] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-45">{sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {draft.status === "sent" ? "Déjà envoyée" : "Envoyer maintenant"}</button>
          </div>
        </AdminCard>
      </div>

      {notice ? <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-[#3d2119] px-4 py-3 text-sm text-white shadow-xl">{notice}</div> : null}
    </AdminWorkspace>
  );
}
