"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Flame, Gauge, RefreshCw, Save, Snowflake, Sparkles, ThermometerSun, Zap } from "lucide-react";
import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

type Temperature = "hot" | "warm" | "cold";
type Lead = {
  id:string; name:string; firstName:string; lastName:string; company:string|null; email:string; country:string|null; need:string;
  status:string; assignedTo:string|null; dealValue:number; lastContactedAt:string|null; tagCount:number; overdueTasks:number;
  score:number; temperature:Temperature; priority:"urgent"|"high"|"normal"|"low"; signals:string[];
};
type Settings = {
  stagePoints:Record<string,number>; hotThreshold:number; warmThreshold:number; highValueThreshold:number; staleAfterDays:number;
  tagBonusEnabled:boolean; settingsAvailable:boolean; updatedAt:string|null;
};
type Data = {
  settings:Settings;
  metrics:{total:number;active:number;hot:number;warm:number;cold:number;urgent:number;averageScore:number;hotPipelineValue:number};
  leads:Lead[];
};

const stageLabels:Record<string,string>={new:"Nouveau",to_contact:"À contacter",contacted:"Contacté",appointment:"RDV planifié",proposal:"Proposition",negotiation:"Négociation",won:"Signé",lost:"Perdu"};
const empty:Data={settings:{stagePoints:{},hotThreshold:70,warmThreshold:40,highValueThreshold:10000,staleAfterDays:14,tagBonusEnabled:true,settingsAvailable:true,updatedAt:null},metrics:{total:0,active:0,hot:0,warm:0,cold:0,urgent:0,averageScore:0,hotPipelineValue:0},leads:[]};

function money(value:number){return new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(value)}
function badge(temp:Temperature){return temp==="hot"?"bg-[#f7d7c4] text-[#8a3519]":temp==="warm"?"bg-[#f6ead8] text-[#8a6236]":"bg-[#eceae8] text-[#5b2f22]/55"}
function label(temp:Temperature){return temp==="hot"?"CHAUD":temp==="warm"?"TIÈDE":"FROID"}

export default function ScoringPage(){
  const [data,setData]=useState<Data>(empty);
  const [draft,setDraft]=useState<Settings>(empty.settings);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [notice,setNotice]=useState("");
  const [filter,setFilter]=useState<"all"|Temperature>("all");

  async function load(){
    setLoading(true);setNotice("");
    const response=await fetch("/api/admin/crm/scoring",{cache:"no-store"});
    if(response.status===401){location.href="/admin/login";return}
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){setNotice(payload.error??"Impossible de charger le scoring.");setLoading(false);return}
    setData(payload as Data);setDraft((payload as Data).settings);setLoading(false);
  }
  useEffect(()=>{void load()},[]);

  async function save(){
    setBusy("save");setNotice("");
    try{
      const response=await fetch("/api/admin/crm/scoring",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){setNotice(payload.error??"Enregistrement impossible.");return}
      setNotice("Modèle de scoring enregistré.");await load();
    }finally{setBusy("")}
  }

  async function action(name:"sync_priority_tags"|"create_hot_automation"){
    setBusy(name);setNotice("");
    try{
      const response=await fetch("/api/admin/crm/scoring",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:name})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){setNotice(payload.error??"Action impossible.");return}
      if(name==="sync_priority_tags") setNotice(`Priorités synchronisées : ${payload.result?.changed??0} prospect(s) mis à jour, ${payload.result?.triggered??0} déclenchement(s) d’automatisation.`);
      else setNotice("Automatisation « Prospect chaud » créée désactivée. Vous pouvez maintenant la vérifier puis l’activer dans Automatisations.");
      await load();
    }finally{setBusy("")}
  }

  const visible=useMemo(()=>data.leads.filter((lead)=>filter==="all"||lead.temperature===filter),[data.leads,filter]);

  return <AdminWorkspace active="Scoring" title="Scoring des prospects" subtitle="Classez les opportunités de 0 à 100 à partir de signaux commerciaux explicites, puis transformez automatiquement le score en priorités et automatisations." actions={<div className="flex flex-wrap gap-2"><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm"><RefreshCw size={15}/> Actualiser</button><button onClick={()=>void action("sync_priority_tags")} disabled={busy==="sync_priority_tags"} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm disabled:opacity-50"><Sparkles size={15}/> Synchroniser les priorités</button><button onClick={()=>void save()} disabled={busy==="save"} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"><Save size={15}/> Enregistrer</button></div>}>
    {notice?<div className="mb-5 rounded-xl border border-[#d8bda9] bg-[#fff8f2] px-4 py-3 text-xs text-[#6f351f]">{notice}</div>:null}
    {!data.settings.settingsAvailable?<div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">La migration CRM Scoring n’est pas encore appliquée : les scores utilisent le modèle par défaut, mais vos réglages ne peuvent pas encore être persistés.</div>:null}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <article className="admin-card admin-shadow p-5"><Gauge size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{loading?"…":data.metrics.averageScore}</strong><span className="text-[10px] text-[#5b2f22]/45">score moyen actif</span></article>
      <article className="admin-card admin-shadow p-5"><Flame size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{data.metrics.hot}</strong><span className="text-[10px] text-[#5b2f22]/45">prospects chauds</span></article>
      <article className="admin-card admin-shadow p-5"><ThermometerSun size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{data.metrics.warm}</strong><span className="text-[10px] text-[#5b2f22]/45">prospects tièdes</span></article>
      <article className="admin-card admin-shadow p-5"><Snowflake size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{data.metrics.cold}</strong><span className="text-[10px] text-[#5b2f22]/45">prospects froids</span></article>
      <article className="admin-card admin-shadow p-5"><Zap size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{data.metrics.urgent}</strong><span className="text-[10px] text-[#5b2f22]/45">priorités urgentes</span></article>
      <article className="admin-card admin-shadow p-5"><Sparkles size={17} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-2xl font-normal">{money(data.metrics.hotPipelineValue)}</strong><span className="text-[10px] text-[#5b2f22]/45">pipeline chaud</span></article>
    </div>

    <div className="mt-5 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
      <AdminCard title="Modèle de scoring">
        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <label>Seuil chaud<input type="number" min={1} max={100} value={draft.hotThreshold} onChange={(e)=>setDraft((d)=>({...d,hotThreshold:Number(e.target.value)}))} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5"/></label>
          <label>Seuil tiède<input type="number" min={0} max={99} value={draft.warmThreshold} onChange={(e)=>setDraft((d)=>({...d,warmThreshold:Number(e.target.value)}))} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5"/></label>
          <label>Valeur considérée élevée<input type="number" min={0} value={draft.highValueThreshold} onChange={(e)=>setDraft((d)=>({...d,highValueThreshold:Number(e.target.value)}))} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5"/></label>
          <label>Inactif après X jours<input type="number" min={1} max={90} value={draft.staleAfterDays} onChange={(e)=>setDraft((d)=>({...d,staleAfterDays:Number(e.target.value)}))} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5"/></label>
          <label className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-[#5b2f22]/8 bg-[#fffaf6] p-3"><input type="checkbox" checked={draft.tagBonusEnabled} onChange={(e)=>setDraft((d)=>({...d,tagBonusEnabled:e.target.checked}))}/> Bonus lorsque le prospect possède déjà un ciblage/tag CRM</label>
        </div>
        <div className="mt-4"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#5b2f22]/45">Points par étape</p><div className="mt-2 grid grid-cols-2 gap-2">{Object.entries(stageLabels).map(([stage,name])=><label key={stage} className="rounded-lg border border-[#5b2f22]/8 bg-white p-2 text-[9px] text-[#5b2f22]/45"><span className="block">{name}</span><input type="number" min={0} max={100} value={draft.stagePoints[stage]??0} onChange={(e)=>setDraft((d)=>({...d,stagePoints:{...d.stagePoints,[stage]:Number(e.target.value)}}))} className="mt-1 w-full border-0 bg-transparent text-sm font-semibold text-[#301b15] outline-none"/></label>)}</div></div>
        <div className="mt-4 rounded-xl bg-[#f8f0e9] p-4 text-[10px] leading-5 text-[#5b2f22]/55">Le score utilise uniquement les données commerciales volontairement enregistrées dans le CRM : étape, valeur, fraîcheur du suivi, complétude du dossier, tags et relances en retard. Aucune donnée de santé ni caractéristique sensible n’est utilisée.</div>
      </AdminCard>

      <AdminCard title="Automatiser les prospects chauds">
        <div className="rounded-xl border border-[#5b2f22]/8 bg-[#fffaf6] p-5"><div className="flex items-start gap-3"><Flame size={20} className="mt-0.5 text-[#9d4c27]"/><div><strong className="text-sm">Score chaud → tag CRM → automatisation</strong><p className="mt-1 text-xs leading-5 text-[#5b2f22]/50">La synchronisation attribue automatiquement les tags « Score chaud », « Score tiède » ou « Score froid ». Le cron des automatisations les maintient ensuite à jour. Les règles par tag existantes peuvent donc agir immédiatement lorsqu’un prospect change de priorité.</p></div></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>void action("create_hot_automation")} disabled={busy==="create_hot_automation"} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50"><Zap size={14}/> Créer la règle prospects chauds</button><Link href="/admin/automatisations" className="rounded-lg border border-[#5b2f22]/10 bg-white px-4 py-2.5 text-xs">Ouvrir Automatisations</Link><Link href="/admin/automatisations/crm" className="rounded-lg border border-[#5b2f22]/10 bg-white px-4 py-2.5 text-xs">Ciblage CRM</Link></div></div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-[#f8e0d2] p-3"><strong className="block text-lg">≥ {draft.hotThreshold}</strong><span className="text-[9px]">Chaud</span></div><div className="rounded-lg bg-[#f8ecdc] p-3"><strong className="block text-lg">≥ {draft.warmThreshold}</strong><span className="text-[9px]">Tiède</span></div><div className="rounded-lg bg-[#efedeb] p-3"><strong className="block text-lg">&lt; {draft.warmThreshold}</strong><span className="text-[9px]">Froid</span></div></div>
      </AdminCard>
    </div>

    <section className="mt-5 admin-card admin-shadow overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#5b2f22]/8 px-5 py-4"><div><h2 className="moony-serif text-2xl">File de priorité commerciale</h2><p className="mt-1 text-[10px] text-[#5b2f22]/42">Les prospects sont triés par score puis par valeur d’opportunité.</p></div><div className="ml-auto flex rounded-lg border border-[#5b2f22]/10 bg-[#f8efe8] p-1">{(["all","hot","warm","cold"] as const).map((value)=><button key={value} onClick={()=>setFilter(value)} className={`rounded-md px-3 py-2 text-[10px] ${filter===value?"bg-white font-semibold text-[#7e3518] shadow-sm":"text-[#5b2f22]/55"}`}>{value==="all"?"Tous":value==="hot"?"Chauds":value==="warm"?"Tièdes":"Froids"}</button>)}</div></div>
      <div className="divide-y divide-[#5b2f22]/7">{visible.length?visible.slice(0,80).map((lead)=><div key={lead.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[80px_1fr_auto]"><div className="text-center"><strong className="moony-serif block text-3xl">{lead.score}</strong><span className={`mt-1 inline-block rounded-full px-2 py-1 text-[8px] font-semibold ${badge(lead.temperature)}`}>{label(lead.temperature)}</span></div><div className="min-w-0"><Link href={`/admin/crm?lead=${lead.id}`} className="text-sm font-semibold hover:text-[#9d4c27]">{lead.name}</Link><p className="mt-1 text-[10px] text-[#5b2f22]/42">{stageLabels[lead.status]??lead.status} · {lead.assignedTo||"Non assigné"}{lead.country?` · ${lead.country}`:""}</p><p className="mt-2 text-[10px] leading-4 text-[#5b2f22]/55">{lead.signals.slice(0,4).join(" · ")}</p></div><div className="text-right"><strong className="text-sm">{money(lead.dealValue)}</strong><span className="mt-1 block text-[9px] uppercase text-[#5b2f22]/40">Priorité {lead.priority}</span>{lead.overdueTasks?<span className="mt-1 block text-[9px] text-red-600">{lead.overdueTasks} relance(s) en retard</span>:null}</div></div>):<p className="px-5 py-12 text-center text-xs text-[#5b2f22]/40">Aucun prospect dans cette catégorie.</p>}</div>
    </section>
  </AdminWorkspace>;
}
