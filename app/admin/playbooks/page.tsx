"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpenCheck, Check, Clipboard, Clock3, Flame, MessageSquareText, PhoneCall, Plus, RefreshCw, Sparkles, Target, ToggleLeft, ToggleRight } from "lucide-react";
import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

type Temperature = "hot" | "warm" | "cold";
type Recommendation = {
  lead: {
    id:string; name:string; firstName:string; lastName:string; email:string; company:string|null; country:string|null; need:string; status:string;
    assignedTo:string|null; dealValue:number; staleDays:number; score:number; temperature:Temperature; scorePriority:"urgent"|"high"|"normal"|"low"; signals:string[];
  };
  playbook: {
    id:string; name:string; description:string; systemKey:string|null; objective:string; nextAction:string; dueInHours:number;
    taskPriority:"low"|"normal"|"high"|"urgent"; channel:"call"|"email"|"whatsapp"|"meeting"; argumentPoints:string[]; message:string;
  };
  alternatives:{id:string;name:string}[];
};
type Playbook = {
  id:string; system_key:string|null; name:string; description:string|null; active:boolean; priority:number;
  conditions:Record<string,unknown>; guidance:{objective:string;next_action:string;due_in_hours:number;task_priority:string;channel:string;argument_points:string[];message_template:string};
  updated_at:string;
};
type Run = {id:string;playbook_id:string|null;lead_id:string;status:string;applied_by:string|null;created_at:string;completed_at:string|null};
type Payload = {available:boolean;playbooks:Playbook[];recommendations:Recommendation[];recentRuns:Run[];metrics:{activePlaybooks:number;recommendations:number;urgent:number;dueToday:number}};

const empty:Payload={available:true,playbooks:[],recommendations:[],recentRuns:[],metrics:{activePlaybooks:0,recommendations:0,urgent:0,dueToday:0}};
const needLabels:Record<string,string>={demonstration:"Démonstration",rappel:"Rappel",professionnel:"Professionnel",partenariat:"Partenariat",entreprise:"Entreprise",presse:"Presse",carriere:"Carrière",confidentialite:"Confidentialité",protections:"Protections",legal:"Juridique",autre:"Autre"};
const statusLabels:Record<string,string>={new:"Nouveau",to_contact:"À contacter",contacted:"Contacté",appointment:"RDV planifié",proposal:"Proposition",negotiation:"Négociation",won:"Signé",lost:"Perdu"};

function money(value:number){return new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(value)}
function tempLabel(value:Temperature){return value==="hot"?"CHAUD":value==="warm"?"TIÈDE":"FROID"}
function tempClass(value:Temperature){return value==="hot"?"bg-[#f7d7c4] text-[#8a3519]":value==="warm"?"bg-[#f7ead8] text-[#8a6236]":"bg-[#eceae8] text-[#5b2f22]/55"}
function channelLabel(value:string){return value==="call"?"Appel":value==="whatsapp"?"WhatsApp":value==="meeting"?"Réunion":"E-mail"}
function when(hours:number){if(hours<=0)return"Maintenant";if(hours<24)return`Sous ${hours} h`;const days=Math.round(hours/24);return`Sous ${days} j`}
function stringList(value:unknown){return Array.isArray(value)?value.map(String):[]}

export default function PlaybooksPage(){
  const [data,setData]=useState<Payload>(empty);
  const [loading,setLoading]=useState(true);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState("");
  const [filter,setFilter]=useState<"all"|Temperature>("all");
  const [selectedId,setSelectedId]=useState<string>("");
  const [creatorOpen,setCreatorOpen]=useState(false);
  const [draft,setDraft]=useState({name:"",description:"",need:"",temperature:"",nextAction:"",objective:"",message:"",dueInHours:24,channel:"email",priority:100});

  async function load(silent=false){
    if(!silent)setLoading(true);setNotice("");
    try{
      const response=await fetch("/api/admin/crm/playbooks",{cache:"no-store"});
      if(response.status===401){location.href="/admin/login";return}
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){setNotice(payload.error??"Impossible de charger les playbooks.");return}
      const next={...empty,...payload} as Payload;setData(next);
      setSelectedId((current)=>current&&next.recommendations.some((item)=>item.lead.id===current)?current:(next.recommendations[0]?.lead.id??""));
    }finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[]);

  const visible=useMemo(()=>data.recommendations.filter((item)=>filter==="all"||item.lead.temperature===filter),[data.recommendations,filter]);
  const selected=data.recommendations.find((item)=>item.lead.id===selectedId)??visible[0]??null;

  async function apply(item:Recommendation){
    setBusy(`apply:${item.lead.id}`);setNotice("");
    try{
      const response=await fetch("/api/admin/crm/playbooks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"apply",leadId:item.lead.id,playbookId:item.playbook.id})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){setNotice(payload.error??"Impossible d’appliquer le playbook.");return}
      setNotice(`Playbook « ${item.playbook.name} » appliqué : la prochaine tâche commerciale a été créée.`);await load(true);
    }finally{setBusy("")}
  }

  async function toggle(playbook:Playbook){
    setBusy(`toggle:${playbook.id}`);setNotice("");
    try{
      const response=await fetch("/api/admin/crm/playbooks",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:playbook.id,active:!playbook.active})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){setNotice(payload.error??"Modification impossible.");return}
      await load(true);
    }finally{setBusy("")}
  }

  async function create(){
    if(!draft.name.trim()||!draft.nextAction.trim()){setNotice("Donnez au minimum un nom et une prochaine action au playbook.");return}
    setBusy("create");setNotice("");
    try{
      const conditions:Record<string,unknown>={};
      if(draft.need)conditions.needs=[draft.need];
      if(draft.temperature)conditions.temperatures=[draft.temperature];
      const response=await fetch("/api/admin/crm/playbooks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create",name:draft.name,description:draft.description,priority:draft.priority,conditions,guidance:{objective:draft.objective,next_action:draft.nextAction,due_in_hours:draft.dueInHours,task_priority:"normal",channel:draft.channel,argument_points:[],message_template:draft.message}})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){setNotice(payload.error??"Création impossible.");return}
      setDraft({name:"",description:"",need:"",temperature:"",nextAction:"",objective:"",message:"",dueInHours:24,channel:"email",priority:100});setCreatorOpen(false);setNotice("Nouveau playbook commercial créé.");await load(true);
    }finally{setBusy("")}
  }

  async function copyMessage(message:string){
    try{await navigator.clipboard.writeText(message);setNotice("Message de relance copié.")}catch{setNotice("Impossible de copier automatiquement le message.")}
  }

  return <AdminWorkspace active="Playbooks" title="Playbooks commerciaux" subtitle="Transformez le score, le besoin et l’étape CRM en prochaine action concrète, argumentaire et relance prête à personnaliser — avec validation humaine avant toute prise de contact." actions={<div className="flex flex-wrap gap-2"><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm"><RefreshCw size={15}/> Actualiser</button><button onClick={()=>setCreatorOpen((value)=>!value)} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-4 py-2.5 text-sm font-medium text-white"><Plus size={15}/> Nouveau playbook</button></div>}>
    {notice?<div className="mb-5 rounded-xl border border-[#d8bda9] bg-[#fff8f2] px-4 py-3 text-xs text-[#6f351f]">{notice}</div>:null}
    {!data.available?<div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-xs leading-5 text-amber-800">La migration CRM Playbooks n’est pas encore appliquée. Appliquez <strong>20260911035000_crm_playbooks.sql</strong> pour activer cette couche dans le Control Center.</div>:null}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="admin-card admin-shadow p-5"><BookOpenCheck size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{loading?"…":data.metrics.activePlaybooks}</strong><span className="text-[10px] text-[#5b2f22]/45">playbooks actifs</span></article>
      <article className="admin-card admin-shadow p-5"><Target size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{data.metrics.recommendations}</strong><span className="text-[10px] text-[#5b2f22]/45">prospects avec recommandation</span></article>
      <article className="admin-card admin-shadow p-5"><Flame size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{data.metrics.urgent}</strong><span className="text-[10px] text-[#5b2f22]/45">priorités urgentes</span></article>
      <article className="admin-card admin-shadow p-5"><Clock3 size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{data.metrics.dueToday}</strong><span className="text-[10px] text-[#5b2f22]/45">actions recommandées sous 24 h</span></article>
    </div>

    {creatorOpen?<section className="mt-5 admin-card admin-shadow p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="moony-serif text-2xl">Créer un playbook</h2><p className="mt-1 text-xs text-[#5b2f22]/45">Ciblez un besoin et/ou une température, puis définissez l’action et le message proposés à l’équipe.</p></div><button onClick={()=>setCreatorOpen(false)} className="text-xs text-[#7e3518]">Fermer</button></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input value={draft.name} onChange={(e)=>setDraft((d)=>({...d,name:e.target.value}))} placeholder="Nom du playbook" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm xl:col-span-2"/><input type="number" min={1} max={1000} value={draft.priority} onChange={(e)=>setDraft((d)=>({...d,priority:Number(e.target.value)}))} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm"/><select value={draft.temperature} onChange={(e)=>setDraft((d)=>({...d,temperature:e.target.value}))} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm"><option value="">Toutes températures</option><option value="hot">Chaud</option><option value="warm">Tiède</option><option value="cold">Froid</option></select><select value={draft.need} onChange={(e)=>setDraft((d)=>({...d,need:e.target.value}))} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm"><option value="">Tous besoins</option>{Object.entries(needLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><select value={draft.channel} onChange={(e)=>setDraft((d)=>({...d,channel:e.target.value}))} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm"><option value="email">E-mail</option><option value="call">Appel</option><option value="whatsapp">WhatsApp</option><option value="meeting">Réunion</option></select><input type="number" min={0} max={720} value={draft.dueInHours} onChange={(e)=>setDraft((d)=>({...d,dueInHours:Number(e.target.value)}))} placeholder="Délai heures" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm"/><input value={draft.nextAction} onChange={(e)=>setDraft((d)=>({...d,nextAction:e.target.value}))} placeholder="Prochaine action" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm xl:col-span-2"/><textarea value={draft.objective} onChange={(e)=>setDraft((d)=>({...d,objective:e.target.value}))} placeholder="Objectif commercial" rows={3} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm xl:col-span-2"/><textarea value={draft.message} onChange={(e)=>setDraft((d)=>({...d,message:e.target.value}))} placeholder="Message proposé — variables : {{first_name}}, {{company}}, {{need}}" rows={4} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm xl:col-span-2"/><textarea value={draft.description} onChange={(e)=>setDraft((d)=>({...d,description:e.target.value}))} placeholder="Description interne" rows={4} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm xl:col-span-2"/></div><div className="mt-4 flex justify-end"><button onClick={()=>void create()} disabled={busy==="create"} className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white disabled:opacity-50">Créer le playbook</button></div></section>:null}

    <div className="mt-5 grid gap-4 2xl:grid-cols-[.9fr_1.1fr]">
      <section className="admin-card admin-shadow overflow-hidden"><div className="flex flex-wrap items-center gap-3 border-b border-[#5b2f22]/8 px-5 py-4"><div><h2 className="moony-serif text-2xl">File recommandée</h2><p className="mt-1 text-[10px] text-[#5b2f22]/42">Priorisée par urgence commerciale, score puis valeur.</p></div><div className="ml-auto flex rounded-lg border border-[#5b2f22]/10 bg-[#f8efe8] p-1">{(["all","hot","warm","cold"] as const).map((value)=><button key={value} onClick={()=>setFilter(value)} className={`rounded-md px-3 py-2 text-[10px] ${filter===value?"bg-white font-semibold text-[#7e3518] shadow-sm":"text-[#5b2f22]/55"}`}>{value==="all"?"Tous":value==="hot"?"Chauds":value==="warm"?"Tièdes":"Froids"}</button>)}</div></div><div className="max-h-[760px] overflow-auto divide-y divide-[#5b2f22]/7">{visible.length?visible.map((item)=><button key={item.lead.id} onClick={()=>setSelectedId(item.lead.id)} className={`w-full px-5 py-4 text-left transition ${selected?.lead.id===item.lead.id?"bg-[#fff6ef]":"hover:bg-[#fffaf6]"}`}><div className="flex items-start gap-3"><div className="min-w-[46px] text-center"><strong className="moony-serif block text-2xl">{item.lead.score}</strong><span className={`rounded-full px-2 py-1 text-[8px] font-semibold ${tempClass(item.lead.temperature)}`}>{tempLabel(item.lead.temperature)}</span></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{item.lead.name}</strong><span className="shrink-0 text-[9px] text-[#9d4c27]">{when(item.playbook.dueInHours)}</span></div><p className="mt-1 text-[10px] text-[#5b2f22]/42">{statusLabels[item.lead.status]??item.lead.status} · {needLabels[item.lead.need]??item.lead.need}{item.lead.country?` · ${item.lead.country}`:""}</p><p className="mt-2 text-xs font-medium text-[#6f351f]">{item.playbook.name}</p><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#5b2f22]/45">{item.playbook.nextAction}</p></div><ArrowRight size={14} className="mt-1 shrink-0 text-[#9d4c27]"/></div></button>):<p className="py-14 text-center text-xs text-[#5b2f22]/40">Aucune recommandation pour ce filtre.</p>}</div></section>

      {selected?<section className="admin-card admin-shadow p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${tempClass(selected.lead.temperature)}`}>{tempLabel(selected.lead.temperature)} · {selected.lead.score}/100</span><span className="rounded-full bg-[#f7eee8] px-2.5 py-1 text-[9px] text-[#7e3518]">{channelLabel(selected.playbook.channel)}</span><span className="text-[9px] text-[#5b2f22]/40">{when(selected.playbook.dueInHours)}</span></div><h2 className="moony-serif mt-3 text-3xl">{selected.lead.name}</h2><p className="mt-1 text-xs text-[#5b2f22]/45">{selected.lead.email} · {statusLabels[selected.lead.status]??selected.lead.status} · {needLabels[selected.lead.need]??selected.lead.need}{selected.lead.dealValue?` · ${money(selected.lead.dealValue)}`:""}</p></div><Link href={`/admin/crm?lead=${selected.lead.id}`} className="rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs">Ouvrir la fiche CRM</Link></div><div className="mt-5 rounded-xl bg-[#f8f0e9] p-5"><p className="text-[9px] font-semibold uppercase tracking-[.14em] text-[#9d4c27]">Playbook recommandé</p><h3 className="moony-serif mt-2 text-2xl">{selected.playbook.name}</h3><p className="mt-2 text-xs leading-5 text-[#5b2f22]/55">{selected.playbook.description}</p></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><AdminCard title="Objectif & prochaine action"><p className="text-xs leading-5 text-[#5b2f22]/60">{selected.playbook.objective}</p><div className="mt-4 rounded-xl border border-[#5b2f22]/8 bg-white p-4"><div className="flex gap-2"><Target size={16} className="mt-0.5 shrink-0 text-[#9d4c27]"/><div><strong className="text-xs">{selected.playbook.nextAction}</strong><p className="mt-1 text-[10px] text-[#5b2f22]/42">{channelLabel(selected.playbook.channel)} · {when(selected.playbook.dueInHours)} · priorité {selected.playbook.taskPriority}</p></div></div></div></AdminCard><AdminCard title="Argumentaire"><div className="space-y-3">{selected.playbook.argumentPoints.length?selected.playbook.argumentPoints.map((point,index)=><div key={point} className="flex gap-3 text-xs leading-5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f3e4d3] text-[9px] font-semibold text-[#7e3518]">{index+1}</span><span>{point}</span></div>):<p className="text-xs text-[#5b2f22]/40">Aucun argumentaire enregistré.</p>}</div></AdminCard></div><AdminCard title="Relance proposée" action={<button onClick={()=>void copyMessage(selected.playbook.message)} className="inline-flex items-center gap-1 rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-[10px]"><Clipboard size={12}/> Copier</button>}><pre className="whitespace-pre-wrap font-sans text-xs leading-6 text-[#4d3027]">{selected.playbook.message||"Aucun message enregistré pour ce playbook."}</pre></AdminCard><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#5b2f22]/8 bg-[#fffaf6] p-4"><div className="flex items-center gap-3"><Sparkles size={18} className="text-[#9d4c27]"/><div><strong className="text-xs">Appliquer avec validation humaine</strong><p className="mt-1 text-[10px] text-[#5b2f22]/45">Crée la prochaine tâche et ajoute le playbook à la timeline CRM. Aucun message n’est envoyé automatiquement.</p></div></div><button onClick={()=>void apply(selected)} disabled={busy===`apply:${selected.lead.id}`} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50"><Check size={14}/> Créer la prochaine action</button></div></section>:<section className="admin-card admin-shadow grid min-h-[420px] place-items-center p-10 text-center"><div><MessageSquareText className="mx-auto text-[#9d4c27]"/><p className="mt-3 text-sm">Sélectionnez un prospect pour afficher son playbook.</p></div></section>}
    </div>

    <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><AdminCard title="Bibliothèque des playbooks"><div className="divide-y divide-[#5b2f22]/7">{data.playbooks.map((playbook)=><div key={playbook.id} className="flex flex-wrap items-start gap-3 py-3"><BookOpenCheck size={16} className="mt-1 shrink-0 text-[#9d4c27]"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{playbook.name}</strong>{playbook.system_key?<span className="text-[8px] uppercase tracking-[.12em] text-[#5b2f22]/35">MOONY</span>:<span className="text-[8px] uppercase tracking-[.12em] text-[#5b2f22]/35">Équipe</span>}</div><p className="mt-1 text-[10px] leading-4 text-[#5b2f22]/45">{playbook.description}</p><p className="mt-1 text-[9px] text-[#9d4c27]">Priorité {playbook.priority} · {stringList(playbook.conditions.needs).map((need)=>needLabels[need]??need).join(", ")||"tous besoins"} · {stringList(playbook.conditions.temperatures).map((temp)=>tempLabel(temp as Temperature)).join(", ")||"toutes températures"}</p></div><button onClick={()=>void toggle(playbook)} disabled={busy===`toggle:${playbook.id}`} className="rounded-lg border border-[#5b2f22]/10 bg-white p-2 text-[#7e3518]" title={playbook.active?"Désactiver":"Activer"}>{playbook.active?<ToggleRight size={20}/>:<ToggleLeft size={20}/>}</button></div>)}{!data.playbooks.length?<p className="py-10 text-center text-xs text-[#5b2f22]/40">Aucun playbook disponible.</p>:null}</div></AdminCard><AdminCard title="Principes du système"><div className="space-y-4 text-xs leading-5 text-[#5b2f22]/55"><div className="flex gap-3"><PhoneCall size={16} className="mt-0.5 shrink-0 text-[#9d4c27]"/><p>Les playbooks proposent une prochaine action ; ils ne contactent jamais seuls un prospect depuis cet écran.</p></div><div className="flex gap-3"><Target size={16} className="mt-0.5 shrink-0 text-[#9d4c27]"/><p>Le matching repose sur des signaux commerciaux explicites : score CRM, étape, besoin, valeur et récence du suivi.</p></div><div className="flex gap-3"><Clipboard size={16} className="mt-0.5 shrink-0 text-[#9d4c27]"/><p>L’application d’un playbook laisse une trace dans la timeline et dans le journal d’audit.</p></div><Link href="/admin/scoring" className="inline-flex items-center gap-2 text-[#7e3518]">Ouvrir le scoring <ArrowRight size={13}/></Link></div></AdminCard></div>
  </AdminWorkspace>;
}
