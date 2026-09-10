"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Eye, FilePlus2, Loader2, Save, Trash2 } from "lucide-react";
import { AdminHeroEditor, type AdminHeroContent } from "@/components/admin-hero-editor";
import { AdminPagePreview } from "@/components/admin-page-preview";
import { AdminSectionEditor } from "@/components/admin-section-editor";
import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";
import type { CmsSection } from "@/lib/cms-types";

type PageMetadata={canonicalUrl?:string;noIndex?:boolean;ogImageUrl?:string;ogTitle?:string;ogDescription?:string};
type CmsPage = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  seo_title: string | null;
  seo_description: string | null;
  hero: AdminHeroContent;
  sections: CmsSection[];
  metadata: PageMetadata;
  created_at?: string;
  updated_at: string;
};

const now = () => new Date().toISOString();
const fallbackPages: CmsPage[] = [
  { id:"home", title:"Accueil", slug:"/", status:"published", seo_title:null, seo_description:null, hero:{ title:"Ancrée dans nos cultures, tournée vers l’avenir.", body:"Une expérience de santé féminine qui réunit transmission, communauté, bien-être et innovation à chaque étape de la vie.", primaryLabel:"Découvrir la communauté", primaryHref:"/communaute", secondaryLabel:"Nos services", secondaryHref:"/services" }, sections:[], metadata:{}, updated_at:now() },
  { id:"mission", title:"Notre mission", slug:"/notre-mission", status:"published", seo_title:null, seo_description:null, hero:{ title:"Notre mission\nRendre la santé féminine plus accessible, plus humaine et plus enracinée dans les réalités des femmes africaines.", body:"De la puberté à la maternité, du post-partum au bien-être quotidien, MOONY informe, accompagne et relie les femmes à des ressources fiables, des professionnelles de santé et une communauté bienveillante.", imagePosition:"65% center" }, sections:[], metadata:{}, updated_at:now() },
  { id:"approach", title:"Notre approche", slug:"/notre-approche", status:"published", seo_title:null, seo_description:null, hero:{ title:"Écouter,\norienter,\naccompagner.", body:"MOONY relie information fiable, communauté bienveillante et accès à des professionnelles pour accompagner les femmes à chaque étape de leur vie.", imagePosition:"68% center" }, sections:[], metadata:{}, updated_at:now() },
  { id:"about", title:"À propos", slug:"/a-propos", status:"published", seo_title:null, seo_description:null, hero:{ eyebrow:"À propos", title:"Une histoire de soin,\nde transmission\net d’horizons.", imagePosition:"61% center" }, sections:[], metadata:{}, updated_at:now() },
  { id:"services", title:"Nos services", slug:"/services", status:"published", seo_title:null, seo_description:null, hero:{}, sections:[], metadata:{}, updated_at:now() },
  { id:"community", title:"Communauté", slug:"/communaute", status:"published", seo_title:null, seo_description:null, hero:{ imagePosition:"65% center" }, sections:[], metadata:{}, updated_at:now() },
  { id:"resources", title:"Ressources", slug:"/ressources", status:"published", seo_title:null, seo_description:null, hero:{}, sections:[], metadata:{}, updated_at:now() },
];

function emptyPage(): CmsPage {
  return { id:"", title:"Nouvelle page", slug:"/nouvelle-page", status:"draft", seo_title:"", seo_description:"", hero:{ title:"Titre principal", body:"Texte d’introduction de la page.", primaryLabel:"Découvrir", primaryHref:"/", imagePosition:"65% center" }, sections:[], metadata:{}, updated_at:now() };
}
function humanDate(value:string){return new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
function comparable(page:CmsPage){return JSON.stringify({title:page.title,slug:page.slug,status:page.status,seo_title:page.seo_title??"",seo_description:page.seo_description??"",hero:page.hero??{},sections:page.sections??[],metadata:page.metadata??{}});}

export default function PagesAdmin(){
  const [pages,setPages]=useState<CmsPage[]>(fallbackPages);
  const [selectedId,setSelectedId]=useState(fallbackPages[0].id);
  const [draft,setDraft]=useState<CmsPage>(fallbackPages[0]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [connected,setConnected]=useState(false);
  const selected=useMemo(()=>pages.find(page=>page.id===selectedId)??null,[pages,selectedId]);
  const dirty=useMemo(()=>selected?comparable(draft)!==comparable(selected):true,[draft,selected]);

  useEffect(()=>{void loadPages()},[]);
  useEffect(()=>{const handler=(event:BeforeUnloadEvent)=>{if(!dirty)return;event.preventDefault();event.returnValue=""};window.addEventListener("beforeunload",handler);return()=>window.removeEventListener("beforeunload",handler)},[dirty]);
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="s"){event.preventDefault();void save()}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler)});

  function selectPage(page:CmsPage){if(dirty&&selectedId!==page.id&&!confirm("Vous avez des modifications non enregistrées. Changer de page quand même ?"))return;setSelectedId(page.id);setDraft(structuredClone({...page,metadata:page.metadata??{}}));setNotice("");}
  async function loadPages(){setLoading(true);try{const response=await fetch("/api/admin/pages",{cache:"no-store"});if(response.status===401){location.href="/admin/login";return}if(!response.ok)throw new Error(String(response.status));const data=await response.json();const rows=((data.pages??[]) as CmsPage[]).map(page=>({...page,metadata:page.metadata??{}}));if(rows.length){const requestedId=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("page"):null;const target=(requestedId?rows.find(page=>page.id===requestedId):null)??rows[0];setPages(rows);setSelectedId(target.id);setDraft(structuredClone(target))}setConnected(true)}catch{setConnected(false)}finally{setLoading(false)}}
  function startNew(){if(dirty&&selected&&!confirm("Vous avez des modifications non enregistrées. Créer une nouvelle page quand même ?"))return;setSelectedId("");setDraft(emptyPage());setNotice("")}
  async function save(statusOverride?:CmsPage["status"]):Promise<CmsPage|null>{setSaving(true);setNotice("");const nextStatus=statusOverride??draft.status;try{const response=await fetch("/api/admin/pages",{method:draft.id?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:draft.id,title:draft.title,slug:draft.slug,status:nextStatus,seoTitle:draft.seo_title,seoDescription:draft.seo_description,hero:draft.hero,sections:draft.sections,metadata:draft.metadata})});const data=await response.json();if(response.status===401){location.href="/admin/login";return null}if(!response.ok)throw new Error(data.error||"Enregistrement impossible.");const saved={...(data.page as CmsPage),metadata:(data.page as CmsPage).metadata??{}};setPages(current=>current.some(page=>page.id===saved.id)?current.map(page=>page.id===saved.id?saved:page):[saved,...current]);setSelectedId(saved.id);setDraft(saved);setConnected(true);setNotice(nextStatus==="published"?"Page publiée. Cette version est maintenant visible sur le site.":nextStatus==="archived"?"Page archivée.":"Brouillon enregistré sans publication.");return saved}catch(error){setNotice(error instanceof Error?error.message:"Enregistrement impossible.");return null}finally{setSaving(false)}}
  function duplicate(){setSelectedId("");setDraft({...structuredClone(draft),id:"",title:`${draft.title} — copie`,slug:`${draft.slug==="/"?"/accueil":draft.slug}-copie`,status:"draft",metadata:{...(draft.metadata??{}),canonicalUrl:""},updated_at:now()});setNotice("Copie créée en brouillon. Elle n’est pas encore enregistrée.")}
  function previewDraft(){try{const token=globalThis.crypto?.randomUUID?.()??`${Date.now()}`;localStorage.setItem(`moony-page-preview:${token}`,JSON.stringify(draft));window.open(`/admin/preview?draft=${encodeURIComponent(token)}`,"_blank");setNotice("Aperçu privé ouvert dans un nouvel onglet.")}catch{setNotice("Impossible d’ouvrir l’aperçu privé dans ce navigateur.")}}
  async function removePage(){if(!draft.id||!confirm(`Supprimer définitivement la page « ${draft.title} » ?`))return;setSaving(true);try{const response=await fetch(`/api/admin/pages?id=${encodeURIComponent(draft.id)}`,{method:"DELETE"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Suppression impossible.");const next=pages.filter(page=>page.id!==draft.id);setPages(next);if(next.length){setSelectedId(next[0].id);setDraft(structuredClone(next[0]))}else{setSelectedId("");setDraft(emptyPage())}setNotice("Page supprimée.")}catch(error){setNotice(error instanceof Error?error.message:"Suppression impossible.")}finally{setSaving(false)}}

  const hasUnsavedStatusChange=selected?selected.status!==draft.status:draft.status!=="draft";
  const publishedLive=selected?.status==="published";

  return <AdminWorkspace active="Pages" title="Pages & CMS" subtitle="Votre mini-Shopify MOONY : textes, images, CTA, SEO, aperçu privé et publication sans toucher au code." actions={<><button onClick={previewDraft} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm"><Eye size={15}/>Aperçu</button><button onClick={()=>void save()} disabled={saving||!dirty} className="inline-flex items-center gap-2 rounded-lg border border-[#7e3518]/20 bg-white px-4 py-2.5 text-sm text-[#7e3518] disabled:opacity-40">{saving?<Loader2 className="animate-spin" size={15}/>:<Save size={15}/>}Enregistrer</button>{publishedLive?<button onClick={()=>void save("draft")} disabled={saving} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">Dépublier</button>:<button onClick={()=>void save("published")} disabled={saving} className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white disabled:opacity-50">Publier</button>}</>}>
    {!connected&&!loading?<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><span>Mode aperçu : connectez le Control Center et appliquez les migrations Supabase pour enregistrer les changements.</span><Link href="/admin/login" className="font-semibold underline">Se connecter</Link></div>:null}

    <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${dirty?"border-amber-200 bg-amber-50 text-amber-900":"border-emerald-200 bg-emerald-50 text-emerald-900"}`}><div><strong>{dirty?"Modifications non enregistrées":"Tout est enregistré"}</strong><span className="ml-2 opacity-70">{selected?`Dernière sauvegarde : ${humanDate(selected.updated_at)}`:"Nouvelle page non enregistrée"}</span></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 ${draft.status==="published"?"bg-emerald-100 text-emerald-800":draft.status==="archived"?"bg-zinc-100 text-zinc-700":"bg-amber-100 text-amber-800"}`}>{draft.status==="published"?"Publié":draft.status==="archived"?"Archivé":"Brouillon"}</span><span className="text-[10px] opacity-60">⌘/Ctrl + S pour enregistrer</span></div></div>

    <div className="grid gap-4 2xl:grid-cols-[.78fr_1.22fr]">
      <AdminCard title="Toutes les pages" action={<div className="flex items-center gap-2"><span className="text-xs text-[#5b2f22]/45">{loading?"Chargement…":`${pages.length} pages`}</span><button onClick={startNew} className="inline-flex items-center gap-1.5 rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs"><FilePlus2 size={13}/>Nouvelle</button></div>}><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-xs text-[#5b2f22]/45"><tr><th className="pb-3">Titre</th><th>URL</th><th>Modification</th><th>Statut</th></tr></thead><tbody>{pages.map(page=><tr key={page.id} onClick={()=>selectPage(page)} className={`cursor-pointer border-t border-[#5b2f22]/8 transition hover:bg-[#fbf4ee] ${selectedId===page.id?"bg-[#f8ece4]":""}`}><td className="py-4 font-medium">{page.title}</td><td className="text-[#5b2f22]/55">{page.slug}</td><td className="text-[#5b2f22]/55">{humanDate(page.updated_at)}</td><td><span className={`rounded-full px-3 py-1 text-xs ${page.status==="published"?"bg-emerald-100 text-emerald-800":page.status==="archived"?"bg-zinc-100 text-zinc-600":"bg-amber-100 text-amber-800"}`}>{page.status==="published"?"Publié":page.status==="archived"?"Archivé":"Brouillon"}</span></td></tr>)}</tbody></table></div></AdminCard>

      <div className="space-y-4">
        <AdminCard title={draft.id?`Modifier — ${draft.title}`:"Créer une page"} action={<div className="flex gap-2"><button onClick={duplicate} className="inline-flex items-center gap-1.5 rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"><Copy size={13}/>Dupliquer</button>{draft.id?<button onClick={()=>void removePage()} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700"><Trash2 size={13}/>Supprimer</button>:null}</div>}>
          {publishedLive&&dirty?<div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Cette page est déjà publique.</strong> Le bouton « Enregistrer » mettra immédiatement ces modifications en ligne. Utilisez « Aperçu » pour vérifier avant de sauvegarder.</div>:null}
          <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-semibold">Titre interne</span><input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm"/></label><label><span className="mb-1.5 block text-xs font-semibold">URL</span><input value={draft.slug} onChange={e=>setDraft({...draft,slug:e.target.value})} className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm"/></label><label><span className="mb-1.5 block text-xs font-semibold">Statut</span><select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as CmsPage["status"]})} className="w-full rounded-xl border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm"><option value="draft">Brouillon</option><option value="published">Publié</option><option value="archived">Archivé</option></select>{hasUnsavedStatusChange?<span className="mt-1 block text-[10px] text-amber-700">Ce changement de statut n’est pas encore enregistré.</span>:null}</label><div className="flex items-end">{selected?.status==="published"?<a href={selected.slug||"/"} target="_blank" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#5b2f22]/12 bg-[#fffaf4] px-3 py-3 text-sm"><ExternalLink size={14}/>Ouvrir la version publique</a>:<button type="button" onClick={previewDraft} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#5b2f22]/12 bg-[#fffaf4] px-3 py-3 text-sm"><Eye size={14}/>Aperçu privé</button>}</div></div>
          <div className="mt-6 border-t border-[#5b2f22]/10 pt-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#8b4b32]">Hero / introduction</p><div className="mt-4"><AdminHeroEditor hero={draft.hero??{}} allowImage={draft.slug!=="/"} imageHelp="Cette image remplace uniquement le hero de cette page. Le cadrage est conservé sur desktop et mobile." onChange={hero=>setDraft(current=>({...current,hero}))}/></div></div>
        </AdminCard>

        <AdminCard title="Blocs de contenu"><AdminSectionEditor sections={draft.sections??[]} onChange={sections=>setDraft(current=>({...current,sections}))}/></AdminCard>
        <AdminCard title="Prévisualisation instantanée" action={<span className="rounded-full bg-[#eef6ef] px-3 py-1 text-[10px] font-semibold text-emerald-700">Aucune publication nécessaire</span>}><p className="mb-4 text-xs leading-5 text-[#5b2f22]/52">L’aperçu se met à jour pendant que vous écrivez. Le bouton « Aperçu » ouvre également cette version non enregistrée dans un nouvel onglet privé.</p><AdminPagePreview page={draft}/></AdminCard>
        <AdminCard title="SEO & partage" action={<Link href={`/admin/seo${draft.id?`?page=${encodeURIComponent(draft.id)}`:""}`} className="text-xs font-semibold text-[#8d3b19]">SEO avancé →</Link>}><div className="grid gap-4"><label><span className="mb-1 flex justify-between text-xs font-semibold"><span>Titre SEO</span><span className="font-normal text-[#5b2f22]/40">{(draft.seo_title??"").length}/65</span></span><input value={draft.seo_title??""} onChange={e=>setDraft({...draft,seo_title:e.target.value})} className="w-full rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm" placeholder={draft.title}/></label><label><span className="mb-1 flex justify-between text-xs font-semibold"><span>Meta description</span><span className="font-normal text-[#5b2f22]/40">{(draft.seo_description??"").length}/170</span></span><textarea rows={3} value={draft.seo_description??""} onChange={e=>setDraft({...draft,seo_description:e.target.value})} className="w-full resize-none rounded-xl border border-[#5b2f22]/12 px-3 py-3 text-sm"/></label><div className="rounded-xl bg-[#f8eee7] px-4 py-3 text-xs leading-5 text-[#5b2f22]/55">Canonique, noindex, titre social, description sociale et image Open Graph se règlent dans le centre SEO avancé.</div></div></AdminCard>
      </div>
    </div>
    {notice?<div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-[#3d2119] px-4 py-3 text-sm text-white shadow-xl">{notice}</div>:null}
  </AdminWorkspace>;
}
