"use client";

import { Image as ImageIcon, X } from "lucide-react";
import { AdminMediaPicker } from "@/components/admin-media-picker";

export type AdminHeroContent = {
  eyebrow?: string;
  title?: string;
  body?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  imageUrl?: string;
  imageAlt?: string;
  imagePosition?: string;
};

export function AdminHeroEditor({ hero, onChange }: { hero: AdminHeroContent; onChange: (hero: AdminHeroContent) => void }) {
  function patch(key: keyof AdminHeroContent, value: string) {
    onChange({ ...hero, [key]: value });
  }

  return <div className="grid gap-4">
    <label><span className="mb-1 block text-xs font-semibold">Surtitre</span><input value={hero.eyebrow??""} onChange={e=>patch("eyebrow",e.target.value)} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" placeholder="Facultatif"/></label>
    <label><span className="mb-1 block text-xs font-semibold">Titre principal</span><textarea rows={4} value={hero.title??""} onChange={e=>patch("title",e.target.value)} className="w-full resize-none rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm leading-6"/></label>
    <label><span className="mb-1 block text-xs font-semibold">Texte d’introduction</span><textarea rows={4} value={hero.body??""} onChange={e=>patch("body",e.target.value)} className="w-full resize-none rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm leading-6"/></label>

    <div className="rounded-xl border border-[#5b2f22]/10 bg-[#fbf4ee] p-4">
      <div className="mb-3 flex items-center gap-2"><ImageIcon size={14} className="text-[#8d3b19]"/><span className="text-xs font-semibold">Image du hero</span></div>
      {hero.imageUrl?<div className="mb-3 overflow-hidden rounded-xl border border-[#5b2f22]/10 bg-[#efe4dc]"><img src={hero.imageUrl} alt={hero.imageAlt??""} className="h-52 w-full object-cover" style={{objectPosition:hero.imagePosition||"65% center"}}/></div>:<div className="mb-3 grid h-28 place-items-center rounded-xl border border-dashed border-[#5b2f22]/16 bg-white/60 text-xs text-[#5b2f22]/40">Aucune image personnalisée : la photo MOONY par défaut sera utilisée.</div>}
      <div className="flex flex-wrap gap-2"><AdminMediaPicker value={hero.imageUrl??""} label="Choisir dans la bibliothèque" onSelect={asset=>onChange({...hero,imageUrl:asset.url,imageAlt:hero.imageAlt?.trim()?hero.imageAlt:asset.altText})}/>{hero.imageUrl?<button type="button" onClick={()=>onChange({...hero,imageUrl:"",imageAlt:""})} className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-white px-3 py-2.5 text-xs text-red-600"><X size={12}/>Retirer</button>:null}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-[11px] font-semibold">URL de l’image</span><input value={hero.imageUrl??""} onChange={e=>patch("imageUrl",e.target.value)} placeholder="https://…" className="w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5 text-xs"/></label><label><span className="mb-1 block text-[11px] font-semibold">Texte alternatif</span><input value={hero.imageAlt??""} onChange={e=>patch("imageAlt",e.target.value)} placeholder="Décrivez l’image" className="w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5 text-xs"/></label><label><span className="mb-1 block text-[11px] font-semibold">Cadrage</span><select value={hero.imagePosition??"65% center"} onChange={e=>patch("imagePosition",e.target.value)} className="w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5 text-xs"><option value="center center">Centrée</option><option value="40% center">À gauche</option><option value="55% center">Légèrement à gauche</option><option value="65% center">Légèrement à droite</option><option value="72% center">À droite</option><option value="center top">Centrée en haut</option></select></label></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <label><span className="mb-1 block text-xs font-semibold">Bouton principal</span><input value={hero.primaryLabel??""} onChange={e=>patch("primaryLabel",e.target.value)} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm"/></label>
      <label><span className="mb-1 block text-xs font-semibold">Lien principal</span><input value={hero.primaryHref??""} onChange={e=>patch("primaryHref",e.target.value)} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm"/></label>
      <label><span className="mb-1 block text-xs font-semibold">Bouton secondaire</span><input value={hero.secondaryLabel??""} onChange={e=>patch("secondaryLabel",e.target.value)} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm"/></label>
      <label><span className="mb-1 block text-xs font-semibold">Lien secondaire</span><input value={hero.secondaryHref??""} onChange={e=>patch("secondaryHref",e.target.value)} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm"/></label>
    </div>
  </div>;
}
