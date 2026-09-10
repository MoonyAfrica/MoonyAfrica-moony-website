"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Image as ImageIcon, RotateCcw, Save, SlidersHorizontal, Type } from "lucide-react";
import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

type ThemeDraft = {
  accent: string;
  surface: string;
  ink: string;
  overlay: number;
  title: string;
  body: string;
  primaryLabel: string;
  radius: number;
};

const STORAGE_KEY = "moony-web-studio-theme-draft";

const defaults: ThemeDraft = {
  accent: "#7e3518",
  surface: "#fffaf4",
  ink: "#5b2f22",
  overlay: 72,
  title: "Ancrée dans nos cultures, tournée vers l’avenir.",
  body: "Une expérience de santé féminine qui réunit transmission, communauté, bien-être et innovation à chaque étape de la vie.",
  primaryLabel: "Découvrir la communauté",
  radius: 22,
};

const brandPalette = ["#5b2f22", "#7e3518", "#9d4c27", "#b9693d", "#e9b78f", "#f8f0e5", "#fffaf4"];

export default function SiteDesignPage() {
  const [draft, setDraft] = useState<ThemeDraft>(defaults);
  const [saved, setSaved] = useState(false);
  const [panel, setPanel] = useState<"contenu" | "couleurs" | "style">("contenu");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      setDraft({ ...defaults, ...JSON.parse(stored) });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const previewBackground = useMemo(
    () => `linear-gradient(90deg, rgba(47,20,13,${draft.overlay / 100}) 0%, rgba(61,25,15,${Math.max((draft.overlay - 18) / 100, 0.08)}) 32%, rgba(61,25,15,.14) 60%), url('/images/home-hero.jpg')`,
    [draft.overlay],
  );

  function update<K extends keyof ThemeDraft>(key: K, value: ThemeDraft[K]) {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function saveDraft() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  function resetDraft() {
    setDraft(defaults);
    window.localStorage.removeItem(STORAGE_KEY);
    setSaved(false);
  }

  return (
    <AdminWorkspace
      active="Site & Design"
      title="Site & Design"
      subtitle="Personnalisez l’apparence du site public tout en préservant l’identité visuelle MOONY."
      actions={
        <>
          <a href="/" target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm"><ExternalLink size={15} /> Voir le site</a>
          <button onClick={saveDraft} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white"><Save size={15} /> {saved ? "Enregistré" : "Enregistrer"}</button>
        </>
      }
    >
      <div className="grid gap-4 2xl:grid-cols-[390px_1fr]">
        <div className="space-y-4">
          <AdminCard title="Éditeur du thème" action={<button onClick={resetDraft} className="inline-flex items-center gap-1.5 text-xs text-[#8d3b19]"><RotateCcw size={13} /> Réinitialiser</button>}>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#f6ebe3] p-1.5 text-xs">
              <button onClick={() => setPanel("contenu")} className={`rounded-lg px-3 py-2.5 ${panel === "contenu" ? "bg-white font-semibold shadow-sm" : "text-[#5b2f22]/60"}`}>Contenu</button>
              <button onClick={() => setPanel("couleurs")} className={`rounded-lg px-3 py-2.5 ${panel === "couleurs" ? "bg-white font-semibold shadow-sm" : "text-[#5b2f22]/60"}`}>Couleurs</button>
              <button onClick={() => setPanel("style")} className={`rounded-lg px-3 py-2.5 ${panel === "style" ? "bg-white font-semibold shadow-sm" : "text-[#5b2f22]/60"}`}>Style</button>
            </div>

            {panel === "contenu" ? (
              <div className="mt-5 space-y-5">
                <label className="block"><span className="mb-2 flex items-center gap-2 text-xs font-semibold"><Type size={14} /> Titre principal</span><textarea value={draft.title} onChange={(event) => update("title", event.target.value)} rows={3} className="w-full resize-none rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm outline-none transition focus:border-[#9d4c27]/60" /></label>
                <label className="block"><span className="mb-2 block text-xs font-semibold">Texte d’introduction</span><textarea value={draft.body} onChange={(event) => update("body", event.target.value)} rows={4} className="w-full resize-none rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm outline-none transition focus:border-[#9d4c27]/60" /></label>
                <label className="block"><span className="mb-2 block text-xs font-semibold">Bouton principal</span><input value={draft.primaryLabel} onChange={(event) => update("primaryLabel", event.target.value)} className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm outline-none transition focus:border-[#9d4c27]/60" /></label>
                <button className="flex w-full items-center justify-between rounded-xl border border-dashed border-[#5b2f22]/20 bg-[#fffaf4] px-4 py-4 text-left"><span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#f1d9ca]"><ImageIcon size={17} /></span><span><strong className="block text-xs">Image de couverture</strong><span className="text-[11px] text-[#5b2f22]/45">home-hero.jpg</span></span></span><span className="text-xs text-[#8d3b19]">Remplacer</span></button>
              </div>
            ) : null}

            {panel === "couleurs" ? (
              <div className="mt-5 space-y-6">
                <div><p className="text-xs font-semibold">Couleur d’accent</p><div className="mt-3 flex flex-wrap gap-2">{brandPalette.map((color) => <button key={color} onClick={() => update("accent", color)} aria-label={`Choisir ${color}`} className="relative h-10 w-10 rounded-full border border-black/10" style={{ backgroundColor: color }}>{draft.accent === color ? <span className="absolute inset-0 grid place-items-center"><Check size={16} color={color === "#fffaf4" || color === "#f8f0e5" ? "#5b2f22" : "white"} /></span> : null}</button>)}</div></div>
                <label className="block"><span className="mb-2 block text-xs font-semibold">Fond principal</span><div className="flex gap-2"><input type="color" value={draft.surface} onChange={(event) => update("surface", event.target.value)} className="h-11 w-14 rounded-lg border border-[#5b2f22]/12 bg-white p-1" /><input value={draft.surface} onChange={(event) => update("surface", event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#5b2f22]/12 px-3 text-sm" /></div></label>
                <label className="block"><span className="mb-2 block text-xs font-semibold">Couleur des textes</span><div className="flex gap-2"><input type="color" value={draft.ink} onChange={(event) => update("ink", event.target.value)} className="h-11 w-14 rounded-lg border border-[#5b2f22]/12 bg-white p-1" /><input value={draft.ink} onChange={(event) => update("ink", event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#5b2f22]/12 px-3 text-sm" /></div></label>
              </div>
            ) : null}

            {panel === "style" ? (
              <div className="mt-5 space-y-6">
                <label className="block"><span className="mb-2 flex items-center justify-between text-xs font-semibold"><span className="flex items-center gap-2"><SlidersHorizontal size={14} /> Intensité du voile</span><span>{draft.overlay}%</span></span><input type="range" min="35" max="90" value={draft.overlay} onChange={(event) => update("overlay", Number(event.target.value))} className="w-full accent-[#8d3b19]" /></label>
                <label className="block"><span className="mb-2 flex items-center justify-between text-xs font-semibold"><span>Arrondi des cartes et boutons</span><span>{draft.radius}px</span></span><input type="range" min="8" max="36" value={draft.radius} onChange={(event) => update("radius", Number(event.target.value))} className="w-full accent-[#8d3b19]" /></label>
                <div className="rounded-xl border border-[#5b2f22]/10 bg-[#f8eee7] p-4 text-xs leading-5 text-[#5b2f22]/62">La palette MOONY reste la référence. Ces réglages servent à ajuster l’intensité et la mise en scène sans dénaturer l’identité de marque.</div>
              </div>
            ) : null}
          </AdminCard>

          <AdminCard title="État du thème">
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-[#eef6ef] px-3 py-3"><span>Identité MOONY</span><strong className="text-emerald-700">Conforme</strong></div>
              <div className="flex items-center justify-between rounded-lg bg-[#f8eee7] px-3 py-3"><span>Responsive</span><strong>Desktop · Mobile</strong></div>
              <div className="flex items-center justify-between rounded-lg bg-[#f8eee7] px-3 py-3"><span>Brouillon local</span><strong>{typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) ? "Présent" : "Non"}</strong></div>
            </div>
          </AdminCard>
        </div>

        <AdminCard title="Aperçu en direct" action={<span className="rounded-full bg-[#eef6ef] px-3 py-1 text-[10px] font-semibold text-emerald-700">Prévisualisation</span>}>
          <div className="overflow-hidden border border-[#5b2f22]/10 bg-white shadow-[0_18px_60px_rgba(78,40,26,.08)]" style={{ borderRadius: `${draft.radius}px` }}>
            <div className="flex items-center justify-between border-b border-black/6 bg-[#fffaf4] px-5 py-3 text-[10px]" style={{ color: draft.ink }}><span className="moony-serif text-lg">MOONY</span><div className="hidden gap-4 md:flex"><span>Accueil</span><span>Notre mission</span><span>Nos services</span><span>Communauté</span><span>Ressources</span></div><span className="rounded-full px-3 py-1.5 text-white" style={{ backgroundColor: draft.accent }}>Prendre rendez-vous</span></div>
            <div className="min-h-[610px] bg-cover bg-center p-7 sm:p-10 lg:p-14" style={{ backgroundImage: previewBackground }}>
              <div className="flex min-h-[500px] max-w-[560px] flex-col justify-center text-white">
                <h3 className="moony-serif text-[54px] leading-[.94] tracking-[-.045em] sm:text-[66px]">{draft.title}</h3>
                <p className="mt-5 max-w-[460px] text-sm leading-6 text-white/82">{draft.body}</p>
                <div className="mt-7 flex flex-wrap gap-3"><span className="rounded-full px-6 py-3 text-sm font-medium text-white" style={{ backgroundColor: draft.accent, borderRadius: `${draft.radius}px` }}>{draft.primaryLabel}</span><span className="rounded-full border border-white/60 px-6 py-3 text-sm" style={{ borderRadius: `${draft.radius}px` }}>Nos services</span></div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#5b2f22]/10 bg-white p-4 text-sm"><strong className="block">Couleur d’accent</strong><div className="mt-3 flex items-center gap-2"><span className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: draft.accent }} /><span className="text-xs text-[#5b2f22]/48">{draft.accent}</span></div></div>
            <div className="rounded-xl border border-[#5b2f22]/10 bg-white p-4 text-sm"><strong className="block">Voile hero</strong><p className="mt-3 text-2xl moony-serif">{draft.overlay}%</p></div>
            <div className="rounded-xl border border-[#5b2f22]/10 bg-white p-4 text-sm"><strong className="block">Arrondis</strong><p className="mt-3 text-2xl moony-serif">{draft.radius}px</p></div>
          </div>
        </AdminCard>
      </div>
    </AdminWorkspace>
  );
}
