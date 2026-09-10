"use client";

import { useEffect, useState } from "react";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";

type Session={name:string;email:string;role:string;legacy?:boolean};

const roleNames:Record<string,string>={founder:"Founder / Super Admin",admin:"Administrateur",sales:"Commercial",marketing:"Marketing",content:"Contenu",support:"Support",analytics:"Lecture analytique"};

export function AdminAccountMenu(){
 const [session,setSession]=useState<Session|null>(null);const [open,setOpen]=useState(false);
 useEffect(()=>{fetch("/api/admin/session",{cache:"no-store"}).then(r=>r.json()).then(data=>setSession(data.session??null)).catch(()=>undefined)},[]);
 async function logout(){await fetch("/api/admin/session",{method:"DELETE"});location.href="/admin/login"}
 const initials=(session?.name||"MOONY Admin").split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase();
 return <div className="relative hidden border-l border-[#5b2f22]/10 pl-4 sm:block">
  <button onClick={()=>setOpen(v=>!v)} className="flex items-center gap-2 text-left" aria-expanded={open}>
   <div className="grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(145deg,#d8a17e,#a95631)] text-[10px] font-semibold text-white">{initials||"MA"}</div>
   <div className="hidden text-[11px] leading-[1.25] lg:block"><strong className="block max-w-[140px] truncate font-semibold">{session?.name||"MOONY Admin"}</strong><span className="text-[#5b2f22]/45">{session?roleNames[session.role]??session.role:"Control Center"}</span></div>
   <ChevronDown size={13}/>
  </button>
  {open?<div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-[#5b2f22]/10 bg-white p-3 shadow-[0_20px_60px_rgba(52,26,18,.14)]">
   <div className="rounded-xl bg-[#fbf4ee] p-3"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ead1bf] text-[#7e3518]"><UserRound size={16}/></div><div className="min-w-0"><strong className="block truncate text-sm">{session?.name||"MOONY Admin"}</strong><span className="block truncate text-xs text-[#5b2f22]/50">{session?.email||"Session administrateur"}</span><span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-[#8d4b32]"><ShieldCheck size={11}/>{session?roleNames[session.role]??session.role:"Control Center"}</span></div></div></div>
   {session?.legacy?<p className="mx-1 mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">Accès fondateur de secours. Créez un compte nominatif dans Équipe & rôles pour une meilleure traçabilité.</p>:null}
   <button onClick={()=>void logout()} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs text-red-700 hover:bg-red-50"><LogOut size={14}/>Se déconnecter</button>
  </div>:null}
 </div>
}
