"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BarChart3, RefreshCw, Save, Target, TrendingUp } from "lucide-react";
import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

type Stage = { stage:string; label:string; count:number; value:number; probability:number; weighted:number };
type Risk = { id:string; name:string; contact:string; status:string; stageLabel:string; dealValue:number; weightedValue:number; assignedTo:string|null; country:string|null; staleDays:number; overdueTasks:number; reasons:string[] };
type Deal = { id:string; name:string; stage:string; stageLabel:string; dealValue:number; weightedValue:number; assignedTo:string|null };
type Data = {
  settings:{probabilities:Record<string,number>;monthlyTarget:number|null;currency:string;staleAfterDays:number;settingsAvailable:boolean};
  metrics:{leads:number;openDeals:number;pipelineValue:number;weightedForecast:number;wonValue:number;winRate:number;overdueTasks:number;atRiskDeals:number;targetCoverage:number|null};
  stages:Stage[];
  atRisk:Risk[];
  topDeals:Deal[];
};
const empty:Data={settings:{probabilities:{},monthlyTarget:null,currency:"EUR",staleAfterDays:7,settingsAvailable:true},metrics:{leads:0,openDeals:0,pipelineValue:0,weightedForecast:0,wonValue:0,winRate:0,overdueTasks:0,atRiskDeals:0,targetCoverage:null},stages:[],atRisk:[],topDeals:[]};

function money(value:number,currency:string){
  try{return new Intl.NumberFormat("fr-FR",{style:"currency",currency,maximumFractionDigits:0}).format(value)}catch{return `${Math.round(value).toLocaleString("fr-FR")} ${currency}`}
}

export default function ForecastPage(){
  const [data,setData]=useState<Data>(empty);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [draft,setDraft]=useState({monthlyTarget:"",currency:"EUR",staleAfterDays:7,probabilities:{} as Record<string,number>});

  async function load(){
    setLoading(true);setNotice("");
    const response=await fetch("/api/admin/crm/forecast",{cache:"no-store"});
    if(response.status===401){location.href="/admin/login";return}
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){setNotice(payload.error??"Impossible de charger les prévisions.");setLoading(false);return}
    setData(payload as Data);
    setDraft({monthlyTarget:payload.settings.monthlyTarget==null?"":String(payload.settings.monthlyTarget),currency:payload.settings.currency||"EUR",staleAfterDays:payload.settings.staleAfterDays||7,probabilities:{...(payload.settings.probabilities??{})}});
    setLoading(false);
  }

  useEffect(()=>{void load()},[]);

  async function save(){
    setSaving(true);setNotice("");
    try{
      const response=await fetch("/api/admin/crm/forecast",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({monthlyTarget:draft.monthlyTarget===""?null:Number(draft.monthlyTarget),currency:draft.currency,staleAfterDays:draft.staleAfterDays,probabilities:draft.probabilities})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){setNotice(payload.error??"Enregistrement impossible.");return}
      setNotice("Paramètres de prévision enregistrés.");await load();
    }finally{setSaving(false)}
  }

  const maxStage=useMemo(()=>Math.max(1,...data.stages.map((stage)=>stage.value)),[data.stages]);
  const currency=data.settings.currency||"EUR";

  return <AdminWorkspace active="Prévisions" title="Prévisions commerciales" subtitle="Pilotez le pipeline MOONY avec une lecture pondérée par étape, les opportunités à risque et un objectif commercial configurable." actions={<div className="flex gap-2"><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm"><RefreshCw size={15}/> Actualiser</button><button onClick={()=>void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"><Save size={15}/> {saving?"Enregistrement…":"Enregistrer"}</button></div>}>
    {notice?<div className="mb-5 rounded-xl border border-[#d8bda9] bg-[#fff8f2] px-4 py-3 text-xs text-[#6f351f]">{notice}</div>:null}
    {!data.settings.settingsAvailable?<div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">La migration CRM Forecast n’est pas encore appliquée : les prévisions utilisent les probabilités par défaut, mais les réglages ne peuvent pas encore être persistés.</div>:null}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {[
        ["Pipeline ouvert",money(data.metrics.pipelineValue,currency)],
        ["Prévision pondérée",money(data.metrics.weightedForecast,currency)],
        ["Déjà signé",money(data.metrics.wonValue,currency)],
        ["Win rate",`${data.metrics.winRate}%`],
        ["Deals à risque",data.metrics.atRiskDeals],
        ["Relances en retard",data.metrics.overdueTasks],
      ].map(([label,value])=><article key={String(label)} className="admin-card admin-shadow p-5"><p className="text-[10px] text-[#5b2f22]/45">{label}</p><strong className="moony-serif mt-2 block text-3xl font-normal">{loading?"…":value}</strong></article>)}
    </div>

    <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <AdminCard title="Prévision par étape">
        <div className="space-y-4">{data.stages.filter((stage)=>stage.stage!=="lost").map((stage)=><div key={stage.stage}>
          <div className="flex flex-wrap items-end justify-between gap-2 text-xs"><div><strong>{stage.label}</strong><span className="ml-2 text-[10px] text-[#5b2f22]/40">{stage.count} opportunité(s) · probabilité {Math.round(stage.probability*100)}%</span></div><div className="text-right"><strong>{money(stage.value,currency)}</strong><span className="ml-2 text-[10px] text-[#9d4c27]">→ {money(stage.weighted,currency)}</span></div></div>
          <div className="mt-2 h-2 rounded-full bg-[#f2e5db]"><div className="h-2 rounded-full bg-[#9d4c27]" style={{width:`${Math.max(stage.value?4:0,(stage.value/maxStage)*100)}%`}}/></div>
        </div>)}</div>
      </AdminCard>

      <AdminCard title="Objectif & modèle">
        <div className="space-y-4 text-xs">
          <label className="block">Objectif commercial<input type="number" min={0} value={draft.monthlyTarget} onChange={(event)=>setDraft((current)=>({...current,monthlyTarget:event.target.value}))} placeholder="Ex. 25000" className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5 text-sm"/></label>
          <div className="grid grid-cols-2 gap-3"><label>Devise<input value={draft.currency} maxLength={3} onChange={(event)=>setDraft((current)=>({...current,currency:event.target.value.toUpperCase()}))} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5 text-sm"/></label><label>Inactif après X jours<input type="number" min={1} max={90} value={draft.staleAfterDays} onChange={(event)=>setDraft((current)=>({...current,staleAfterDays:Number(event.target.value)}))} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5 text-sm"/></label></div>
          {data.metrics.targetCoverage!==null?<div className="rounded-xl bg-[#f8f0e9] p-4"><div className="flex items-center gap-2"><Target size={16} className="text-[#9d4c27]"/><strong>Couverture de l’objectif</strong></div><p className="moony-serif mt-2 text-4xl">{data.metrics.targetCoverage}%</p><p className="mt-1 text-[10px] leading-4 text-[#5b2f22]/45">Prévision pondérée ÷ objectif configuré. Ce n’est pas une garantie de chiffre d’affaires.</p></div>:null}
          <div><p className="font-semibold">Probabilités par étape</p><div className="mt-2 grid grid-cols-2 gap-2">{data.stages.filter((stage)=>!["won","lost"].includes(stage.stage)).map((stage)=><label key={stage.stage} className="rounded-lg border border-[#5b2f22]/8 bg-white p-2"><span className="block text-[9px] text-[#5b2f22]/45">{stage.label}</span><div className="mt-1 flex items-center gap-1"><input type="number" min={0} max={100} value={Math.round((draft.probabilities[stage.stage]??stage.probability)*100)} onChange={(event)=>setDraft((current)=>({...current,probabilities:{...current.probabilities,[stage.stage]:Math.max(0,Math.min(100,Number(event.target.value)))/100}}))} className="w-full border-0 bg-transparent text-sm font-semibold outline-none"/><span>%</span></div></label>)}</div></div>
        </div>
      </AdminCard>
    </div>

    <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
      <AdminCard title="Opportunités à risque" action={<AlertTriangle size={17} className="text-amber-600"/>}>
        <div className="divide-y divide-[#5b2f22]/7">{data.atRisk.length?data.atRisk.slice(0,12).map((deal)=><div key={deal.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto]"><div><Link href={`/admin/crm?lead=${deal.id}`} className="font-semibold text-sm hover:text-[#9d4c27]">{deal.name}</Link><p className="mt-1 text-[10px] text-[#5b2f22]/42">{deal.stageLabel} · {deal.assignedTo||"Non assigné"}{deal.country?` · ${deal.country}`:""}</p><p className="mt-1 text-[10px] text-amber-700">{deal.reasons.join(" · ")}</p></div><div className="text-right"><strong className="text-sm">{money(deal.dealValue,currency)}</strong><span className="block text-[9px] text-[#5b2f22]/40">pondéré {money(deal.weightedValue,currency)}</span></div></div>):<p className="py-10 text-center text-xs text-[#5b2f22]/40">Aucune opportunité à risque selon le seuil actuel.</p>}</div>
      </AdminCard>

      <AdminCard title="Plus grosses opportunités" action={<TrendingUp size={17} className="text-[#9d4c27]"/>}>
        <div className="divide-y divide-[#5b2f22]/7">{data.topDeals.length?data.topDeals.map((deal)=><div key={deal.id} className="flex items-center gap-3 py-3"><BarChart3 size={15} className="shrink-0 text-[#9d4c27]"/><div className="min-w-0 flex-1"><Link href={`/admin/crm?lead=${deal.id}`} className="block truncate text-sm font-semibold hover:text-[#9d4c27]">{deal.name}</Link><span className="text-[10px] text-[#5b2f22]/42">{deal.stageLabel} · {deal.assignedTo||"Non assigné"}</span></div><div className="text-right"><strong className="text-sm">{money(deal.dealValue,currency)}</strong><span className="block text-[9px] text-[#9d4c27]">{money(deal.weightedValue,currency)} prévus</span></div><Link href={`/admin/crm?lead=${deal.id}`} className="rounded-lg border border-[#5b2f22]/10 p-2"><ArrowRight size={14}/></Link></div>):<p className="py-10 text-center text-xs text-[#5b2f22]/40">Aucune opportunité valorisée pour le moment.</p>}</div>
      </AdminCard>
    </div>

    <p className="mt-5 text-[10px] leading-5 text-[#5b2f22]/40">Le forecast repose uniquement sur les données commerciales explicitement enregistrées dans le CRM et sur les probabilités configurées par l’équipe. Il ne déduit ni genre, ni caractéristiques personnelles, ni données de santé.</p>
  </AdminWorkspace>;
}
