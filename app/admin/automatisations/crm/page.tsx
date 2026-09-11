"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, RefreshCw, Tags, Target, ToggleLeft, ToggleRight, Users, Zap } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";

type Tag = { id:string; name:string; slug:string; color:string };
type Segment = { id:string; name:string; description:string|null; filters:Record<string,unknown>; visibility:"team"|"private"; is_pinned:boolean };
type Rule = {
  id:string;
  name:string;
  description:string|null;
  trigger_type:"lead_tag_added"|"segment_match"|string;
  enabled:boolean;
  conditions:Record<string,unknown>;
  actions:unknown[];
  last_run_at:string|null;
  run_count:number;
};
type Capabilities = { email:boolean; cron:boolean };

type TargetMode = "tag"|"segment";

function ids(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function date(value:string|null){
  if(!value)return "Jamais";
  return new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
}

export default function CrmAutomationTargetingPage(){
  const [tags,setTags]=useState<Tag[]>([]);
  const [segments,setSegments]=useState<Segment[]>([]);
  const [rules,setRules]=useState<Rule[]>([]);
  const [capabilities,setCapabilities]=useState<Capabilities>({email:false,cron:false});
  const [tagsAvailable,setTagsAvailable]=useState(true);
  const [segmentsAvailable,setSegmentsAvailable]=useState(true);
  const [mode,setMode]=useState<TargetMode>("tag");
  const [name,setName]=useState("");
  const [selectedTargets,setSelectedTargets]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [notice,setNotice]=useState("");

  async function load(){
    setLoading(true);setNotice("");
    try{
      const [crmResponse,automationResponse]=await Promise.all([
        fetch("/api/admin/crm/segments",{cache:"no-store"}),
        fetch("/api/admin/automations",{cache:"no-store"}),
      ]);
      if(crmResponse.status===401||automationResponse.status===401){location.href="/admin/login";return}
      const crm=await crmResponse.json().catch(()=>({}));
      const automations=await automationResponse.json().catch(()=>({}));
      if(!crmResponse.ok){setNotice(crm.error??"Impossible de charger les ciblages CRM.");return}
      if(!automationResponse.ok){setNotice(automations.error??"Impossible de charger les automatisations.");return}
      setTags(crm.tags??[]);setSegments(crm.segments??[]);
      setTagsAvailable(crm.tagsAvailable??true);setSegmentsAvailable(crm.segmentsAvailable??true);
      setRules((automations.rules??[]).filter((rule:Rule)=>rule.trigger_type==="lead_tag_added"||rule.trigger_type==="segment_match"));
      setCapabilities(automations.capabilities??{email:false,cron:false});
    }finally{setLoading(false)}
  }

  useEffect(()=>{void load()},[]);

  const targets=mode==="tag"?tags:segments;
  const relevantRules=useMemo(()=>rules.filter((rule)=>rule.trigger_type===(mode==="tag"?"lead_tag_added":"segment_match")),[rules,mode]);

  function toggleTarget(id:string){
    setSelectedTargets((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);
  }

  function changeMode(next:TargetMode){setMode(next);setSelectedTargets([]);setNotice("")}

  async function createRule(){
    if(!name.trim()){setNotice("Donnez un nom à l’automatisation.");return}
    if(!selectedTargets.length){setNotice(mode==="tag"?"Sélectionnez au moins un tag.":"Sélectionnez au moins un segment.");return}
    setBusy("create");setNotice("");
    try{
      const triggerType=mode==="tag"?"lead_tag_added":"segment_match";
      const conditions=mode==="tag"?{tag_ids:selectedTargets}:{segment_ids:selectedTargets};
      const response=await fetch("/api/admin/automations",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          name:name.trim(),
          triggerType,
          enabled:false,
          description:mode==="tag"?"Déclenchée dès qu’un des tags CRM sélectionnés est ajouté à un prospect.":"Déclenchée lorsqu’un prospect correspond à l’un des segments CRM sélectionnés.",
          conditions,
        }),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){setNotice(payload.error??"Création impossible.");return}
      setName("");setSelectedTargets([]);setNotice("Automatisation créée désactivée. Configurez ses actions puis activez-la quand elle est prête.");await load();
    }finally{setBusy("")}
  }

  async function toggleRule(rule:Rule){
    setBusy(`toggle:${rule.id}`);setNotice("");
    try{
      const response=await fetch("/api/admin/automations",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:rule.id,enabled:!rule.enabled})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){setNotice(payload.error??"Modification impossible.");return}
      await load();
    }finally{setBusy("")}
  }

  return <AdminShell active="Ciblage CRM">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#9d4c27]">CRM + Automatisations</p>
        <h1 className="moony-serif mt-1 text-4xl tracking-[-.035em] text-[#5b2f22]">Ciblage CRM</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b2f22]/52">Transformez vos tags et segments sauvegardés en déclencheurs commerciaux : grand compte, partenaires Sénégal, prospects prioritaires ou toute autre vue CRM.</p>
      </div>
      <div className="flex gap-2"><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm"><RefreshCw size={15}/> Actualiser</button><Link href="/admin/automatisations" className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-4 py-2.5 text-sm font-medium text-white">Builder complet <ArrowRight size={15}/></Link></div>
    </div>

    {notice?<div className="mt-5 rounded-xl border border-[#d8bda9] bg-[#fff8f2] px-4 py-3 text-xs text-[#6f351f]">{notice}</div>:null}
    {!tagsAvailable||!segmentsAvailable?<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Appliquez la migration CRM V2 pour activer complètement tags et segments.</div>:null}
    {!capabilities.cron?<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Les automatisations par tag sont immédiates. Les automatisations par segment ont besoin du scheduler relié à <code>/api/cron/automations</code> pour détecter automatiquement les nouveaux membres.</div>:null}

    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <article className="admin-card admin-shadow p-5"><Tags size={18} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{tags.length}</strong><span className="text-[10px] text-[#5b2f22]/45">tags CRM disponibles</span></article>
      <article className="admin-card admin-shadow p-5"><Users size={18} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{segments.length}</strong><span className="text-[10px] text-[#5b2f22]/45">segments sauvegardés</span></article>
      <article className="admin-card admin-shadow p-5"><Zap size={18} className="text-[#9d4c27]"/><strong className="moony-serif mt-3 block text-3xl font-normal">{rules.filter((rule)=>rule.enabled).length}</strong><span className="text-[10px] text-[#5b2f22]/45">ciblages automatisés actifs</span></article>
    </div>

    <section className="mt-5 admin-card admin-shadow p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="moony-serif text-2xl">Créer un ciblage automatisé</h2><p className="mt-1 text-xs text-[#5b2f22]/45">La règle naît désactivée. Vous pourrez ensuite construire sa séquence complète dans le builder.</p></div><div className="flex rounded-lg border border-[#5b2f22]/10 bg-[#f8efe8] p-1"><button onClick={()=>changeMode("tag")} className={`rounded-md px-3 py-2 text-xs ${mode==="tag"?"bg-white font-semibold text-[#7e3518] shadow-sm":"text-[#5b2f22]/55"}`}>Quand un tag est ajouté</button><button onClick={()=>changeMode("segment")} className={`rounded-md px-3 py-2 text-xs ${mode==="segment"?"bg-white font-semibold text-[#7e3518] shadow-sm":"text-[#5b2f22]/55"}`}>Quand un prospect correspond à un segment</button></div></div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[.75fr_1.25fr]">
        <div><label className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#5b2f22]/45">Nom de la règle<input value={name} onChange={(event)=>setName(event.target.value)} placeholder={mode==="tag"?"Ex. Grand compte → relance Founder":"Ex. Partenaires Sénégal → séquence dédiée"} className="mt-2 block w-full rounded-lg border border-[#5b2f22]/12 bg-white px-3 py-3 text-sm font-normal normal-case tracking-normal text-[#301b15] outline-none"/></label><div className="mt-4 rounded-xl bg-[#f8f0e9] p-4 text-xs leading-5 text-[#5b2f22]/58">{mode==="tag"?"Le déclenchement se fait immédiatement au moment où le tag est ajouté depuis le CRM, y compris par action groupée.":"Le moteur compare régulièrement les prospects aux filtres réellement enregistrés dans le segment : pays, besoin, responsable, valeur, source et tags."}</div></div>
        <div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#5b2f22]/45">{mode==="tag"?"Tags déclencheurs":"Segments déclencheurs"}</p><div className="mt-2 grid max-h-[260px] gap-2 overflow-y-auto sm:grid-cols-2">{loading?<div className="col-span-full py-10 text-center text-xs text-[#5b2f22]/40">Chargement…</div>:targets.length?targets.map((target)=><button key={target.id} onClick={()=>toggleTarget(target.id)} className={`flex items-start gap-3 rounded-xl border p-3 text-left ${selectedTargets.includes(target.id)?"border-[#b9693d] bg-[#fff3e9]":"border-[#5b2f22]/9 bg-white"}`}>{mode==="tag"?<span className="mt-0.5 h-3 w-3 shrink-0 rounded-full" style={{backgroundColor:(target as Tag).color}}/>:<Target size={14} className="mt-0.5 shrink-0 text-[#9d4c27]"/>}<span><strong className="block text-xs">{target.name}</strong>{mode==="segment"?<span className="mt-1 block text-[9px] text-[#5b2f22]/42">{(target as Segment).description||((target as Segment).visibility==="private"?"Vue privée":"Vue équipe")}</span>:null}</span></button>):<div className="col-span-full rounded-xl border border-dashed border-[#5b2f22]/12 py-10 text-center text-xs text-[#5b2f22]/40">{mode==="tag"?"Créez d’abord des tags dans le CRM.":"Enregistrez d’abord une vue comme segment dans le CRM."}</div>}</div></div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#5b2f22]/8 pt-4"><span className="text-[10px] text-[#5b2f22]/40">{selectedTargets.length} cible(s) sélectionnée(s)</span><button onClick={()=>void createRule()} disabled={busy==="create"||!selectedTargets.length} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-5 py-2.5 text-xs font-medium text-white disabled:opacity-45">{busy==="create"?<Loader2 size={14} className="animate-spin"/>:<Zap size={14}/>} Créer l’automatisation</button></div>
    </section>

    <section className="mt-5 admin-card admin-shadow overflow-hidden">
      <div className="flex items-center border-b border-[#5b2f22]/8 px-5 py-4"><div><h2 className="moony-serif text-2xl">Automatisations de ciblage</h2><p className="mt-1 text-[10px] text-[#5b2f22]/42">{mode==="tag"?"Règles déclenchées par ajout de tag":"Règles déclenchées par appartenance à un segment"}</p></div><span className="ml-auto rounded-full bg-[#f7eee8] px-3 py-1 text-[10px] text-[#7e3518]">{relevantRules.length}</span></div>
      <div className="divide-y divide-[#5b2f22]/7">{relevantRules.length?relevantRules.map((rule)=>{
        const targetIds=mode==="tag"?ids(rule.conditions.tag_ids):ids(rule.conditions.segment_ids);
        const labels=targetIds.map((id)=>mode==="tag"?tags.find((tag)=>tag.id===id)?.name:segments.find((segment)=>segment.id===id)?.name).filter(Boolean);
        return <div key={rule.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${rule.enabled?"bg-emerald-100 text-emerald-700":"bg-[#eee8e3] text-[#5b2f22]/55"}`}>{rule.enabled?"ACTIVE":"DÉSACTIVÉE"}</span>{labels.map((label)=><span key={label} className="rounded-full bg-[#fff2e8] px-2 py-1 text-[9px] text-[#8a4023]">{label}</span>)}</div><strong className="mt-2 block text-sm">{rule.name}</strong><p className="mt-1 text-[10px] text-[#5b2f22]/42">{rule.actions?.length??0} action(s) · {rule.run_count} exécution(s) · dernière : {date(rule.last_run_at)}</p></div><div className="flex items-center gap-2"><button onClick={()=>void toggleRule(rule)} disabled={busy===`toggle:${rule.id}`} className="rounded-lg border border-[#5b2f22]/10 bg-white p-2.5 text-[#7e3518]" title={rule.enabled?"Désactiver":"Activer"}>{busy===`toggle:${rule.id}`?<Loader2 size={18} className="animate-spin"/>:rule.enabled?<ToggleRight size={19}/>:<ToggleLeft size={19}/>}</button><Link href="/admin/automatisations" className="rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5 text-xs text-[#7e3518]">Configurer les actions</Link></div></div>
      }):<div className="px-5 py-12 text-center text-xs text-[#5b2f22]/40">Aucune automatisation de ciblage dans cette catégorie.</div>}</div>
    </section>
  </AdminShell>;
}
