"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type SearchResult={id:string;kind:string;title:string;subtitle:string;href:string};

export function AdminGlobalSearch(){
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<SearchResult[]>([]);
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [activeIndex,setActiveIndex]=useState(0);
  const box=useRef<HTMLDivElement>(null);

  useEffect(()=>{const close=(event:MouseEvent)=>{if(box.current&&!box.current.contains(event.target as Node))setOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
  useEffect(()=>{if(query.trim().length<2){setResults([]);setOpen(false);setActiveIndex(0);return}const controller=new AbortController();const timer=setTimeout(async()=>{setLoading(true);try{const response=await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`,{signal:controller.signal,cache:"no-store"});if(response.status===401){location.href="/admin/login";return}const data=await response.json();if(response.ok){setResults(data.results??[]);setActiveIndex(0);setOpen(true)}}catch(error){if((error as Error).name!=="AbortError")setResults([])}finally{setLoading(false)}},220);return()=>{clearTimeout(timer);controller.abort()}},[query]);

  function clear(){setQuery("");setResults([]);setOpen(false);setActiveIndex(0)}
  function navigate(index:number){const result=results[index];if(!result)return;setOpen(false);window.location.href=result.href;}
  function onKeyDown(event:React.KeyboardEvent<HTMLInputElement>){
    if(event.key==="Escape"){setOpen(false);return;}
    if(!open||!results.length)return;
    if(event.key==="ArrowDown"){event.preventDefault();setActiveIndex(index=>(index+1)%results.length);}
    if(event.key==="ArrowUp"){event.preventDefault();setActiveIndex(index=>(index-1+results.length)%results.length);}
    if(event.key==="Enter"){event.preventDefault();navigate(activeIndex);}
  }

  return <div ref={box} className="relative mx-auto w-full max-w-[650px] xl:ml-10 xl:mr-auto">
    <div className="flex items-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-3 py-2.5 text-[12px] shadow-[0_4px_18px_rgba(78,37,24,.025)] focus-within:border-[#a95b3a]/40"><Search size={16} className="shrink-0 text-[#5b2f22]/45"/><input value={query} onFocus={()=>query.trim().length>=2&&setOpen(true)} onChange={e=>setQuery(e.target.value)} onKeyDown={onKeyDown} placeholder="Rechercher un contact, une page, un article…" className="min-w-0 flex-1 bg-transparent text-[#3b2119] outline-none placeholder:text-[#5b2f22]/35"/>{loading?<span className="h-3 w-3 animate-spin rounded-full border border-[#8d3b19]/25 border-t-[#8d3b19]"/>:query?<button onClick={clear} aria-label="Effacer"><X size={14} className="text-[#5b2f22]/35"/></button>:null}</div>
    {open?<div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-[#5b2f22]/10 bg-[#fffdf9] shadow-[0_20px_55px_rgba(52,25,16,.16)]"><div className="flex items-center justify-between border-b border-[#5b2f22]/8 px-4 py-2"><span className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#8d4b32]">Recherche globale</span><span className="hidden text-[9px] text-[#5b2f22]/35 sm:block">↑ ↓ naviguer · Entrée ouvrir · Échap fermer</span></div>{results.length?<div className="max-h-[430px] overflow-y-auto p-2">{results.map((result,index)=><Link key={result.id} href={result.href} onMouseEnter={()=>setActiveIndex(index)} onClick={()=>setOpen(false)} className={`flex items-start gap-3 rounded-lg px-3 py-3 transition ${activeIndex===index?"bg-[#f8ece4]":"hover:bg-[#f8ece4]"}`}><span className="mt-0.5 rounded-full bg-[#f3dfd1] px-2 py-1 text-[9px] font-semibold text-[#8d3b19]">{result.kind}</span><div className="min-w-0"><strong className="block truncate text-xs font-semibold">{result.title}</strong><span className="mt-1 block truncate text-[10px] text-[#5b2f22]/45">{result.subtitle}</span></div></Link>)}</div>:<div className="px-4 py-8 text-center text-xs text-[#5b2f22]/42">Aucun résultat pour « {query} ».</div>}</div>:null}
  </div>;
}
