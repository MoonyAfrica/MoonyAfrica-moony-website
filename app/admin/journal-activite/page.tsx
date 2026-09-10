"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, RefreshCw, Search } from "lucide-react";
import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

type AuditLog={id:string;created_at:string;actor_email:string|null;actor_name:string|null;actor_role:string|null;action:string;entity_type:string;entity_id:string|null;summary:string|null;metadata:Record<string,unknown>};

function when(value:string){return new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}

export default function ActivityJournalPage(){
 const [logs,setLogs]=useState<AuditLog[]>([]);const [loading,setLoading]=useState(true);const [notice,setNotice]=useState("");const [query,setQuery]=useState("");const [entity,setEntity]=useState("");
 const entities=useMemo(()=>Array.from(new Set(logs.map(log=>log.entity_type))).sort(),[logs]);
 const filtered=useMemo(()=>logs.filter(log=>{const hay=`${log.actor_name??""} ${log.actor_email??""} ${log.action} ${log.entity_type} ${log.summary??""}`.toLowerCase();return (!query||hay.includes(query.toLowerCase()))&&(!entity||log.entity_type===entity)}),[logs,query,entity]);
 useEffect(()=>{void load()},[]);
 async function load(){setLoading(true);setNotice("");const r=await fetch("/api/admin/audit?limit=200",{cache:"no-store"});if(r.status===401){location.href="/admin/login";return;}const d=await r.json().catch(()=>({}));if(!r.ok){setNotice(d.error??"Journal indisponible.");setLogs([]);setLoading(false);return;}setLogs(d.logs??[]);setLoading(false)}
 return <AdminWorkspace active="Journal d’activité" title="Journal d’activité" subtitle="Suivez les actions sensibles réalisées dans le Control Center : connexions, création de comptes, publications, réglages et opérations commerciales." actions={<button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/10 bg-white px-4 py-2.5 text-sm"><RefreshCw size={14}/>Actualiser</button>}>
  {notice?<div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</div>:null}
  <AdminCard title="Historique des actions" action={<span className="text-xs text-[#5b2f22]/45">{loading?"Chargement…":`${filtered.length} actions`}</span>}>
   <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px]"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b2f22]/35"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un membre, une action, une page…" className="w-full rounded-xl border border-[#5b2f22]/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none"/></div><div className="relative"><Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b2f22]/35"/><select value={entity} onChange={e=>setEntity(e.target.value)} className="w-full rounded-xl border border-[#5b2f22]/10 bg-white py-2.5 pl-9 pr-3 text-sm"><option value="">Tous les modules</option>{entities.map(value=><option key={value} value={value}>{value}</option>)}</select></div></div>
   <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="text-xs text-[#5b2f22]/45"><tr><th className="pb-3">Date</th><th>Membre</th><th>Action</th><th>Module</th><th>Détail</th></tr></thead><tbody>{filtered.map(log=><tr key={log.id} className="border-t border-[#5b2f22]/8"><td className="py-4 text-xs text-[#5b2f22]/55">{when(log.created_at)}</td><td><strong className="block text-xs">{log.actor_name||"MOONY Admin"}</strong><span className="text-[11px] text-[#5b2f22]/45">{log.actor_email||log.actor_role||"—"}</span></td><td><span className="rounded-full bg-[#f5e5da] px-2.5 py-1 text-[11px] text-[#7e3518]">{log.action}</span></td><td className="text-xs">{log.entity_type}</td><td className="max-w-[360px] text-xs leading-5 text-[#5b2f22]/60">{log.summary||log.entity_id||"—"}</td></tr>)}</tbody></table>{!loading&&!filtered.length?<p className="py-10 text-center text-sm text-[#5b2f22]/45">Aucune action trouvée.</p>:null}</div>
  </AdminCard>
 </AdminWorkspace>
}
