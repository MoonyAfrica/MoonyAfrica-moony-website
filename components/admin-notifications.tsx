"use client";

import Link from "next/link";
import { AlertCircle, Bell, CalendarClock, CheckCircle2, Headphones, ListTodo, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Item={id:string;kind:"task"|"ticket"|"appointment";title:string;subtitle:string;href:string;severity:"info"|"warning"|"urgent";dueAt?:string|null};

const icons={task:ListTodo,ticket:Headphones,appointment:CalendarClock};
function when(value?:string|null){if(!value)return"";const date=new Date(value);if(Number.isNaN(date.getTime()))return"";return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(date)}

export function AdminNotifications(){
 const [items,setItems]=useState<Item[]>([]);const [open,setOpen]=useState(false);const [loading,setLoading]=useState(false);const [available,setAvailable]=useState(true);const box=useRef<HTMLDivElement>(null);
 async function load(){setLoading(true);try{const response=await fetch("/api/admin/notifications",{cache:"no-store"});if(response.status===401){location.href="/admin/login";return}const data=await response.json();if(response.ok){setItems(data.items??[]);setAvailable(data.tasksAvailable??true)}}finally{setLoading(false)}}
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),120000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{const close=(event:MouseEvent)=>{if(box.current&&!box.current.contains(event.target as Node))setOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
 return <div ref={box} className="relative">
  <button onClick={()=>{setOpen(value=>!value);if(!open)void load()}} className="relative rounded-full p-2 transition hover:bg-[#f5e8df]" aria-label="Notifications" aria-expanded={open}><Bell size={18}/>{items.length?<span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[#9d4c27] px-1 text-[8px] font-bold text-white">{items.length>9?"9+":items.length}</span>:null}</button>
  {open?<div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[360px] max-w-[86vw] overflow-hidden rounded-2xl border border-[#5b2f22]/10 bg-[#fffdf9] shadow-[0_24px_65px_rgba(55,26,17,.17)]">
   <div className="flex items-center border-b border-[#5b2f22]/8 px-4 py-3"><div><h3 className="moony-serif text-xl">À surveiller</h3><p className="text-[10px] text-[#5b2f22]/42">Relances, support et rendez-vous imminents.</p></div><button onClick={()=>setOpen(false)} className="ml-auto rounded-full p-1.5 text-[#5b2f22]/40 hover:bg-[#f5e8df]" aria-label="Fermer"><X size={15}/></button></div>
   {!available?<div className="m-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] leading-4 text-amber-800">Les relances commerciales seront incluses après application de la dernière migration Supabase.</div>:null}
   <div className="max-h-[430px] overflow-y-auto p-2">{loading&&!items.length?<div className="py-10 text-center text-xs text-[#5b2f22]/42">Actualisation…</div>:items.length?items.map(item=>{const Icon=icons[item.kind];return <Link key={item.id} href={item.href} onClick={()=>setOpen(false)} className="flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f8ece4]"><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${item.severity==="urgent"?"bg-red-100 text-red-600":item.severity==="warning"?"bg-amber-100 text-amber-700":"bg-[#efe0d5] text-[#8d3b19]"}`}><Icon size={14}/></span><div className="min-w-0 flex-1"><strong className="block truncate text-xs">{item.title}</strong><span className="mt-1 block text-[10px] leading-4 text-[#5b2f22]/48">{item.subtitle}</span>{item.dueAt?<span className="mt-1 block text-[9px] text-[#8d3b19]">{when(item.dueAt)}</span>:null}</div>{item.severity==="urgent"?<AlertCircle size={13} className="mt-1 shrink-0 text-red-500"/>:null}</Link>}):<div className="py-10 text-center"><CheckCircle2 size={30} className="mx-auto text-emerald-500/65"/><p className="mt-2 text-xs font-medium">Rien d’urgent pour le moment.</p><p className="mt-1 text-[10px] text-[#5b2f22]/42">Le Control Center vous signalera les actions qui demandent votre attention.</p></div>}</div>
   <div className="grid grid-cols-2 border-t border-[#5b2f22]/8 bg-[#fbf7f3] p-2 text-[10px]"><Link href="/admin/crm" onClick={()=>setOpen(false)} className="rounded-lg px-3 py-2 text-center hover:bg-white">Ouvrir le CRM</Link><Link href="/admin/service-client" onClick={()=>setOpen(false)} className="rounded-lg px-3 py-2 text-center hover:bg-white">Service client</Link></div>
  </div>:null}
 </div>;
}
