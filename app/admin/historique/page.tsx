"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, History, RotateCcw, Search } from "lucide-react";
import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

type CmsPage={id:string;title:string;slug:string;status:string;updated_at:string};
type Version={id:string;page_id:string;created_at:string;action:"create"|"save"|"publish"|"unpublish"|"archive"|"restore";created_by:string;note:string|null;snapshot:{title?:string;slug?:string;status?:string;hero?:{title?:string};sections?:unknown[];seo_title?:string|null;seo_description?:string|null}};

const labels:Record<Version["action"],string>={create:"Création",save:"Sauvegarde",publish:"Publication",unpublish:"Dépublication",archive:"Archivage",restore:"Restauration"};
function dateTime(value:string){return new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}

export default function HistoryPage(){
 const [pages,setPages]=useState<CmsPage[]>([]);const [selectedId,setSelectedId]=useState("");const [versions,setVersions]=useState<Version[]>([]);const [query,setQuery]=useState("");const [loading,setLoading]=useState(true);const [restoring,setRestoring]=useState("");const [notice,setNotice]=useState("");
 const selected=useMemo(()=>pages.find(page=>page.id===selectedId)??null,[pages,selectedId]);
 const filtered=useMemo(()=>pages.filter(page=>`${page.title} ${page.slug}`.toLowerCase().includes(query.toLowerCase())),[pages,query]);

 useEffect(()=>{void loadPages()},[]);
 async function loadPages(){setLoading(true);const r=await fetch("/api/admin/pages",{cache:"no-store"});if(r.status===401){location.href="/admin/login";return;}const d=await r.json();const rows=(d.pages??[]) as CmsPage[];setPages(rows);const first=rows[0]?.id??"";setSelectedId(first);if(first)await loadVersions(first);setLoading(false)}
 async function loadVersions(pageId:string){setNotice("");const r=await fetch(`/api/admin/pages/${encodeURIComponent(pageId)}/versions`,{cache:"no-store"});if(r.status===401){location.href="/admin/login";return;}const d=await r.json();if(!r.ok){setVersions([]);setNotice(d.error??"Historique indisponible. Vérifiez que la migration Supabase a été appliquée.");return;}setVersions(d.versions??[])}
 async function choose(page:CmsPage){setSelectedId(page.id);await loadVersions(page.id)}
 async function restore(version:Version){if(!selected)return;if(!confirm(`Restaurer la version du ${dateTime(version.created_at)} pour « ${selected.title} » ?\n\nL’état actuel sera sauvegardé automatiquement avant restauration.`))return;setRestoring(version.id);setNotice("Restauration en cours…");const r=await fetch(`/api/admin/pages/${encodeURIComponent(selected.id)}/versions`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({versionId:version.id})});const d=await r.json();if(!r.ok){setNotice(d.error??"Restauration impossible.");setRestoring("");return;}setNotice("Version restaurée. L’état précédent a été conservé dans l’historique.");await Promise.all([loadVersions(selected.id),loadPages()]);setRestoring("")}

 return <AdminWorkspace active="Historique" title="Historique des versions" subtitle="Retrouvez les anciennes versions de vos pages et restaurez-les sans perdre l’état actuel.">
  <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
   <AdminCard title="Pages" action={<span className="text-xs text-[#5b2f22]/45">{loading?"…":pages.length}</span>}>
    <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b2f22]/35" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une page…" className="w-full rounded-xl border border-[#5b2f22]/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none"/></div>
    <div className="space-y-1">{filtered.map(page=><button key={page.id} onClick={()=>void choose(page)} className={`w-full rounded-xl px-3 py-3 text-left transition ${selectedId===page.id?"bg-[#f0d8c6] text-[#6f2d17]":"hover:bg-[#fbf2eb]"}`}><strong className="block text-sm">{page.title}</strong><span className="mt-1 block text-[11px] text-[#5b2f22]/45">{page.slug}</span></button>)}</div>
   </AdminCard>

   <div className="space-y-4">
    <AdminCard title={selected?`Historique — ${selected.title}`:"Historique"} action={selected?<a href={`/admin/pages?page=${selected.id}`} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs">Ouvrir dans Pages</a>:null}>
      {!selected?<p className="text-sm text-[#5b2f22]/50">Sélectionnez une page.</p>:versions.length===0?<div className="rounded-xl border border-dashed border-[#5b2f22]/15 bg-[#fffaf4] p-8 text-center"><History className="mx-auto text-[#8d4b32]" size={24}/><p className="mt-3 text-sm font-medium">Aucune version enregistrée pour le moment.</p><p className="mt-2 text-xs leading-5 text-[#5b2f22]/48">Les prochaines sauvegardes, publications et restaurations créeront automatiquement des points de retour.</p></div>:<div className="space-y-3">{versions.map((version,index)=>{const snap=version.snapshot??{};return <article key={version.id} className="rounded-xl border border-[#5b2f22]/10 bg-white p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${version.action==="publish"?"bg-emerald-100 text-emerald-800":version.action==="restore"?"bg-blue-100 text-blue-800":version.action==="archive"?"bg-zinc-100 text-zinc-700":"bg-[#f5e4d8] text-[#7e3518]"}`}>{labels[version.action]}</span>{index===0?<span className="rounded-full bg-[#f8eee7] px-2.5 py-1 text-[10px] text-[#5b2f22]/60">Plus récente</span>:null}</div><p className="mt-3 flex items-center gap-2 text-sm font-medium"><Clock3 size={14}/>{dateTime(version.created_at)}</p><p className="mt-1 text-xs text-[#5b2f22]/45">Par {version.created_by||"MOONY Admin"}</p>{version.note?<p className="mt-2 text-xs leading-5 text-[#5b2f22]/60">{version.note}</p>:null}</div><button disabled={restoring===version.id} onClick={()=>void restore(version)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#7e3518]/20 bg-[#fffaf4] px-4 py-2.5 text-xs font-semibold text-[#7e3518] disabled:opacity-50"><RotateCcw size={13}/>{restoring===version.id?"Restauration…":"Restaurer"}</button></div><div className="mt-4 grid gap-2 border-t border-[#5b2f22]/8 pt-3 text-[11px] text-[#5b2f22]/55 sm:grid-cols-3"><div><span className="block text-[9px] uppercase tracking-[.14em] opacity-50">Statut</span><strong className="mt-1 block text-[#5b2f22]">{snap.status||"—"}</strong></div><div><span className="block text-[9px] uppercase tracking-[.14em] opacity-50">Titre</span><strong className="mt-1 block truncate text-[#5b2f22]">{snap.hero?.title||snap.title||"—"}</strong></div><div><span className="block text-[9px] uppercase tracking-[.14em] opacity-50">Blocs</span><strong className="mt-1 block text-[#5b2f22]">{Array.isArray(snap.sections)?snap.sections.length:0}</strong></div></div></article>})}</div>}
    </AdminCard>
    {notice?<div className="rounded-xl border border-[#5b2f22]/10 bg-[#f8eee7] px-4 py-3 text-sm text-[#5b2f22]/70">{notice}</div>:null}
   </div>
  </div>
 </AdminWorkspace>;
}
