"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye } from "lucide-react";
import { AdminPagePreview } from "@/components/admin-page-preview";
import type { AdminHeroContent } from "@/components/admin-hero-editor";
import type { CmsSection } from "@/lib/cms-types";

type DraftPage={title:string;slug:string;status:"draft"|"published"|"archived";hero:AdminHeroContent;sections:CmsSection[]};

export default function AdminPreviewPage(){
 const [page,setPage]=useState<DraftPage|null>(null);const [error,setError]=useState("");
 useEffect(()=>{try{const token=new URLSearchParams(window.location.search).get("draft");if(!token){setError("Aucun aperçu transmis.");return;}const raw=localStorage.getItem(`moony-page-preview:${token}`);if(!raw){setError("Cet aperçu a expiré ou n’est plus disponible.");return;}const parsed=JSON.parse(raw) as DraftPage;if(!parsed?.title||!parsed?.slug){setError("Aperçu invalide.");return;}setPage(parsed)}catch{setError("Impossible de charger cet aperçu privé.")}},[]);
 return <main className="min-h-screen bg-[#f2e9e2] text-[#5b2f22]"><header className="sticky top-0 z-20 border-b border-[#5b2f22]/10 bg-[#fffaf4]/95 px-5 py-3 backdrop-blur"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href="/admin/pages" className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs"><ArrowLeft size={14}/>Retour à l’éditeur</Link><div><p className="flex items-center gap-1.5 text-xs font-semibold"><Eye size={13}/>Aperçu privé</p><p className="text-[10px] text-[#5b2f22]/45">Cette version n’est pas publiée tant que vous ne l’enregistrez pas depuis le Control Center.</p></div></div>{page?<div className="flex items-center gap-2 text-xs"><span className="rounded-full bg-white px-3 py-1.5 text-[#5b2f22]/55">{page.slug}</span><span className={`rounded-full px-3 py-1.5 ${page.status==="published"?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{page.status==="published"?"Page actuellement publiée":"Version de travail"}</span></div>:null}</div></header><div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-10">{page?<AdminPagePreview page={page}/>:<div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-800">{error||"Chargement de l’aperçu…"}</div>}</div></main>;
}
