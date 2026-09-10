"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, Loader2, Pause, Play, Plus, Save, Trash2 } from "lucide-react";
import { AdminCard } from "@/components/admin-workspace";

type Kind = "popup" | "banner" | "form" | "campaign";
type Status = "draft" | "active" | "scheduled" | "paused" | "archived";

type MarketingElement = {
  id: string;
  created_at?: string;
  updated_at?: string;
  name: string;
  kind: Kind;
  status: Status;
  placement: string[];
  eyebrow: string | null;
  headline: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  collect_email: boolean;
  start_at: string | null;
  end_at: string | null;
  views: number;
  conversions: number;
  config: Record<string, unknown>;
};

const fallback: MarketingElement[] = [
  { id: "demo-popup", name: "Inscription newsletter", kind: "popup", status: "active", placement: ["/", "/ressources"], eyebrow: "Entre Elles", headline: "Rejoignez notre communauté de femmes.", body: "Recevez nos ressources, nos conseils et les nouveautés MOONY.", cta_label: "Je m’inscris", cta_url: null, collect_email: true, start_at: null, end_at: null, views: 1248, conversions: 105, config: {} },
  { id: "demo-banner", name: "Télécharger MOONY", kind: "banner", status: "active", placement: ["*"], eyebrow: null, headline: "MOONY vous accompagne à chaque étape.", body: "Découvrez l’application.", cta_label: "Ouvrir l’application", cta_url: "https://application.moony-africa.com", collect_email: false, start_at: null, end_at: null, views: 12420, conversions: 758, config: {} },
];

function blank(kind: Kind = "popup"): MarketingElement {
  return { id: "", name: kind === "banner" ? "Nouveau bandeau" : "Nouveau pop-up", kind, status: "draft", placement: ["/"], eyebrow: "MOONY", headline: "Votre message ici", body: "Ajoutez un message clair, chaleureux et utile.", cta_label: kind === "popup" ? "Je découvre" : "En savoir plus", cta_url: "/", collect_email: false, start_at: null, end_at: null, views: 0, conversions: 0, config: {} };
}

const kindLabels: Record<Kind, string> = { popup: "Pop-up", banner: "Bandeau", form: "Formulaire", campaign: "Campagne" };
const statusLabels: Record<Status, string> = { draft: "Brouillon", active: "Actif", scheduled: "Programmé", paused: "En pause", archived: "Archivé" };

export function MarketingEditor({ kindFilter }: { kindFilter?: Kind[] }) {
  const [items, setItems] = useState<MarketingElement[]>(fallback);
  const [selectedId, setSelectedId] = useState(fallback[0].id);
  const [draft, setDraft] = useState<MarketingElement>(fallback[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => kindFilter?.length ? items.filter((item) => kindFilter.includes(item.kind)) : items, [items, kindFilter]);
  const selected = useMemo(() => items.find((item) => item.id === selectedId), [items, selectedId]);

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (selected) setDraft(structuredClone(selected)); }, [selectedId]);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/marketing", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      const rows = (data.elements ?? []) as MarketingElement[];
      if (rows.length) {
        setItems(rows);
        const first = kindFilter?.length ? rows.find((item) => kindFilter.includes(item.kind)) ?? rows[0] : rows[0];
        setSelectedId(first.id);
        setDraft(structuredClone(first));
      }
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  function startNew(kind: Kind = kindFilter?.[0] ?? "popup") {
    const fresh = blank(kind);
    setSelectedId("");
    setDraft(fresh);
    setNotice("");
  }

  async function save() {
    setSaving(true);
    setNotice("");
    try {
      const payload = {
        id: draft.id,
        name: draft.name,
        kind: draft.kind,
        status: draft.status,
        placement: draft.placement,
        eyebrow: draft.eyebrow,
        headline: draft.headline,
        body: draft.body,
        ctaLabel: draft.cta_label,
        ctaUrl: draft.cta_url,
        collectEmail: draft.collect_email,
        startAt: draft.start_at,
        endAt: draft.end_at,
        config: draft.config,
      };
      const response = await fetch("/api/admin/marketing", { method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (response.status === 401) { window.location.href = "/admin/login"; return; }
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
      const saved = data.element as MarketingElement;
      setItems((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setSelectedId(saved.id);
      setDraft(saved);
      setConnected(true);
      setNotice("Élément marketing enregistré.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: MarketingElement) {
    const response = await fetch("/api/admin/marketing", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, status: item.status === "active" ? "paused" : "active" }) });
    if (response.status === 401) { window.location.href = "/admin/login"; return; }
    if (response.ok) {
      const data = await response.json();
      const updated = data.element as MarketingElement;
      setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      if (selectedId === updated.id) setDraft(updated);
    }
  }

  async function remove() {
    if (!draft.id || !window.confirm(`Supprimer « ${draft.name} » ?`)) return;
    const response = await fetch(`/api/admin/marketing?id=${encodeURIComponent(draft.id)}`, { method: "DELETE" });
    if (response.status === 401) { window.location.href = "/admin/login"; return; }
    if (!response.ok) return;
    const next = items.filter((item) => item.id !== draft.id);
    setItems(next);
    const first = (kindFilter?.length ? next.find((item) => kindFilter.includes(item.kind)) : next[0]) ?? blank(kindFilter?.[0] ?? "popup");
    setSelectedId(first.id);
    setDraft(structuredClone(first));
    setNotice("Élément supprimé.");
  }

  function duplicate() {
    setDraft({ ...draft, id: "", name: `${draft.name} — copie`, status: "draft", views: 0, conversions: 0 });
    setSelectedId("");
    setNotice("Copie prête en brouillon. Enregistrez-la pour la conserver.");
  }

  return (
    <div className="space-y-4">
      {!connected && !loading ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><span>Mode aperçu. Connectez-vous pour gérer les campagnes enregistrées.</span><Link href="/admin/login" className="font-semibold underline">Se connecter</Link></div> : null}

      <div className="grid gap-4 2xl:grid-cols-[.9fr_1.1fr]">
        <AdminCard title="Éléments" action={<button onClick={() => startNew()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#7e3518] px-3 py-2 text-xs text-white"><Plus size={13} /> Nouveau</button>}>
          <div className="space-y-2">
            {filtered.map((item) => {
              const conversion = item.views ? `${((item.conversions / item.views) * 100).toFixed(1)}%` : "—";
              return <button key={item.id} onClick={() => setSelectedId(item.id)} className={`grid w-full gap-2 rounded-xl border p-4 text-left text-xs transition sm:grid-cols-[1.4fr_.55fr_.55fr_.55fr_auto] sm:items-center ${selectedId === item.id ? "border-[#b96d48]/45 bg-[#f9ece3]" : "border-[#5b2f22]/8 bg-white hover:bg-[#fffaf4]"}`}>
                <span><strong className="block text-sm">{item.name}</strong><span className="mt-1 block text-[#5b2f22]/42">{item.placement.join(", ")}</span></span>
                <span>{kindLabels[item.kind]}</span>
                <span className={`w-fit rounded-full px-2 py-1 ${item.status === "active" ? "bg-emerald-100 text-emerald-800" : item.status === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-600"}`}>{statusLabels[item.status]}</span>
                <span>{conversion}</span>
                <span onClick={(event) => { event.stopPropagation(); void toggleActive(item); }} className="grid h-8 w-8 place-items-center rounded-full border border-[#5b2f22]/10">{item.status === "active" ? <Pause size={13} /> : <Play size={13} />}</span>
              </button>;
            })}
            {!filtered.length ? <div className="rounded-xl border border-dashed border-[#5b2f22]/16 p-8 text-center text-sm text-[#5b2f22]/45">Aucun élément dans cette catégorie.</div> : null}
          </div>
        </AdminCard>

        <AdminCard title={draft.id ? `Éditeur — ${draft.name}` : "Créer un élément"} action={<div className="flex gap-2"><button onClick={duplicate} className="inline-flex items-center gap-1 rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"><Copy size={13} /> Dupliquer</button>{draft.id ? <button onClick={remove} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700"><Trash2 size={13} /> Supprimer</button> : null}</div>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="mb-1.5 block text-xs font-semibold">Nom interne</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label>
            <label><span className="mb-1.5 block text-xs font-semibold">Type</span><select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as Kind })} className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm"><option value="popup">Pop-up</option><option value="banner">Bandeau</option><option value="form">Formulaire</option><option value="campaign">Campagne</option></select></label>
            <label><span className="mb-1.5 block text-xs font-semibold">Statut</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Status })} className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm"><option value="draft">Brouillon</option><option value="active">Actif</option><option value="scheduled">Programmé</option><option value="paused">En pause</option><option value="archived">Archivé</option></select></label>
            <label><span className="mb-1.5 block text-xs font-semibold">Pages d’affichage</span><input value={draft.placement.join(", ")} onChange={(event) => setDraft({ ...draft, placement: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" placeholder="/, /ressources ou *" /></label>
          </div>

          <div className="mt-5 grid gap-4">
            <label><span className="mb-1.5 block text-xs font-semibold">Surtitre</span><input value={draft.eyebrow ?? ""} onChange={(event) => setDraft({ ...draft, eyebrow: event.target.value })} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label>
            <label><span className="mb-1.5 block text-xs font-semibold">Titre visible</span><input value={draft.headline} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label>
            <label><span className="mb-1.5 block text-xs font-semibold">Message</span><textarea value={draft.body ?? ""} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows={3} className="w-full resize-none rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-semibold">Texte du bouton</span><input value={draft.cta_label ?? ""} onChange={(event) => setDraft({ ...draft, cta_label: event.target.value })} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label><label><span className="mb-1.5 block text-xs font-semibold">Lien</span><input value={draft.cta_url ?? ""} onChange={(event) => setDraft({ ...draft, cta_url: event.target.value })} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" /></label></div>
            <label className="flex items-center gap-3 rounded-xl border border-[#5b2f22]/10 bg-[#fffaf4] p-3 text-sm"><input type="checkbox" checked={draft.collect_email} onChange={(event) => setDraft({ ...draft, collect_email: event.target.checked })} className="h-4 w-4 accent-[#7e3518]" /><span><strong className="block text-xs">Collecter une adresse e-mail</strong><span className="text-[11px] text-[#5b2f22]/45">L’inscription sera envoyée vers la base Newsletter.</span></span></label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 border-t border-[#5b2f22]/10 pt-5"><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[#7e3518] px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer</button><a href={draft.placement[0] === "*" ? "/" : draft.placement[0] || "/"} target="_blank" className="inline-flex items-center gap-2 rounded-full border border-[#5b2f22]/20 px-5 py-3 text-sm"><Eye size={15} /> Voir la page</a></div>
        </AdminCard>
      </div>

      <AdminCard title="Aperçu en direct">
        <div className="relative min-h-[360px] overflow-hidden rounded-[24px] bg-[linear-gradient(115deg,#e8c7ad,#b46f49)] p-6 sm:p-10">
          <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_80%_20%,white,transparent_30%)]" />
          {draft.kind === "banner" ? <div className="relative mx-auto mt-8 flex max-w-4xl items-center justify-center gap-4 rounded-xl bg-[#6d2d17] px-6 py-3 text-center text-sm text-white"><strong>{draft.headline}</strong>{draft.body ? <span className="text-white/75">{draft.body}</span> : null}{draft.cta_label ? <span className="underline">{draft.cta_label}</span> : null}</div> : <div className="relative ml-auto mt-10 max-w-md rounded-[26px] bg-[#fffaf4] p-7 text-[#5b2f22] shadow-2xl"><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#9d4c27]">{draft.eyebrow}</p><h3 className="moony-serif mt-2 text-4xl leading-[1.02]">{draft.headline}</h3><p className="mt-3 text-sm leading-6 text-[#5b2f22]/60">{draft.body}</p>{draft.collect_email ? <div className="mt-5"><div className="rounded-full border border-[#5b2f22]/12 bg-white px-4 py-3 text-xs text-[#5b2f22]/35">Votre adresse e-mail</div><div className="mt-2 rounded-full bg-[#7e3518] px-4 py-3 text-center text-xs text-white">{draft.cta_label || "Je m’inscris"}</div></div> : draft.cta_label ? <div className="mt-5 inline-flex rounded-full bg-[#7e3518] px-5 py-3 text-xs text-white">{draft.cta_label}</div> : null}</div>}
        </div>
      </AdminCard>

      {notice ? <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-[#3d2119] px-4 py-3 text-sm text-white shadow-xl">{notice}</div> : null}
    </div>
  );
}
