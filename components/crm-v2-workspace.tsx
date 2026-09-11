"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarPlus, CheckCircle2, Columns3, Download, Filter, List, Mail, MessageCircle, Phone,
  Plus, RefreshCw, Save, Search, Send, Tags, Trash2, X,
} from "lucide-react";
import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

type Status = "new"|"to_contact"|"contacted"|"appointment"|"proposal"|"negotiation"|"won"|"lost";
type Tag = { id:string; name:string; slug:string; color:string };
type Lead = {
  id:string; created_at:string; updated_at:string; first_name:string; last_name:string; email:string; phone:string|null;
  company:string|null; role_title:string|null; need:string; message:string|null; source:string; status:Status;
  assigned_to:string|null; deal_value:number|null; country:string|null; city:string|null; notes:string|null; last_contacted_at:string|null; tags:Tag[];
};
type ViewMode = "list"|"pipeline";
type Filters = { query:string; statuses:string[]; countries:string[]; needs:string[]; assignees:string[]; sources:string[]; tagIds:string[]; minValue:string; maxValue:string };
type Segment = { id:string; name:string; description:string|null; filters:Filters; view_config:{view?:ViewMode;sort?:string}; visibility:"team"|"private"; owner_user_key:string|null; is_pinned:boolean };
type Activity = { id:string; created_at:string; kind:"note"|"call"|"email"|"whatsapp"|"meeting"|"status"|"proposal"|"system"; summary:string; body:string|null; outcome:string|null; created_by:string|null };
type Task = { id:string; title:string; due_at:string|null; status:"todo"|"in_progress"|"done"|"cancelled"; priority:"low"|"normal"|"high"|"urgent"; assigned_to:string|null; notes:string|null };
type Meta = { tags:Tag[]; segments:Segment[]; dimensions:{countries:string[];needs:string[];assignees:string[];sources:string[]}; tagsAvailable:boolean; segmentsAvailable:boolean };
type DimensionKey = "countries"|"needs"|"assignees"|"sources";
type LeadTextKey = "firstName"|"lastName"|"email"|"phone"|"company"|"roleTitle"|"country"|"city"|"assignedTo"|"source";

const stages:[Status,string][] = [["new","Nouveau"],["to_contact","À contacter"],["contacted","Contacté"],["appointment","RDV planifié"],["proposal","Proposition envoyée"],["negotiation","Négociation"],["won","Signé"],["lost","Perdu"]];
const emptyFilters:Filters = { query:"",statuses:[],countries:[],needs:[],assignees:[],sources:[],tagIds:[],minValue:"",maxValue:"" };
const emptyLead = { firstName:"",lastName:"",email:"",phone:"",company:"",roleTitle:"",need:"entreprise",source:"control-center",status:"new" as Status,assignedTo:"",dealValue:"",country:"",city:"",message:"",notes:"" };
const needValues = ["entreprise","partenariat","professionnel","demonstration","rappel","presse","carriere","confidentialite","protections","legal","autre"];
const activityLabels:Record<Activity["kind"],string> = {note:"Note",call:"Appel",email:"E-mail",whatsapp:"WhatsApp",meeting:"Rendez-vous",status:"Pipeline",proposal:"Proposition",system:"Système"};
const priorityLabels:Record<Task["priority"],string> = {low:"Basse",normal:"Normale",high:"Haute",urgent:"Urgente"};
const leadTextFields:Array<{label:string;key:LeadTextKey;type?:string;required?:boolean}> = [
  {label:"Prénom",key:"firstName",required:true},{label:"Nom",key:"lastName",required:true},{label:"E-mail",key:"email",type:"email",required:true},
  {label:"Téléphone",key:"phone"},{label:"Entreprise",key:"company"},{label:"Fonction",key:"roleTitle"},{label:"Pays",key:"country"},{label:"Ville",key:"city"},
  {label:"Responsable",key:"assignedTo"},{label:"Source",key:"source"},
];

function money(value:number){return new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(value)}
function dateTime(value:string|null){if(!value)return"—";return new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}
function whatsApp(phone:string|null){const clean=(phone||"").replace(/\D/g,"");return clean?`https://wa.me/${clean}`:"#"}
function toggle(list:string[],value:string){return list.includes(value)?list.filter((item)=>item!==value):[...list,value]}
function csvEscape(value:unknown){const text=String(value??"");return `"${text.replace(/"/g,'""')}"`}

export function CrmV2Workspace(){
  const [leads,setLeads]=useState<Lead[]>([]);
  const [meta,setMeta]=useState<Meta>({tags:[],segments:[],dimensions:{countries:[],needs:[],assignees:[],sources:[]},tagsAvailable:true,segmentsAvailable:true});
  const [filters,setFilters]=useState<Filters>(emptyFilters);
  const [view,setView]=useState<ViewMode>("list");
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [selected,setSelected]=useState<Lead|null>(null);
  const [form,setForm]=useState(emptyLead);
  const [loading,setLoading]=useState(true);
  const [notice,setNotice]=useState("");
  const [filtersOpen,setFiltersOpen]=useState(true);
  const [saveSegmentOpen,setSaveSegmentOpen]=useState(false);
  const [segmentName,setSegmentName]=useState("");
  const [segmentPrivate,setSegmentPrivate]=useState(false);
  const [tagName,setTagName]=useState("");
  const [tagColor,setTagColor]=useState("#b9693d");
  const [bulkAction,setBulkAction]=useState("status");
  const [bulkValue,setBulkValue]=useState("");
  const [bulkTask,setBulkTask]=useState({title:"",dueAt:"",priority:"normal",notes:""});
  const [activities,setActivities]=useState<Activity[]>([]);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [activityForm,setActivityForm]=useState({kind:"note" as Activity["kind"],summary:"",body:""});
  const [taskForm,setTaskForm]=useState({title:"",dueAt:"",priority:"normal" as Task["priority"],assignedTo:"",notes:""});

  const dimensionFilters:Array<{label:string;key:DimensionKey;options:string[]}> = [
    {label:"Pays",key:"countries",options:meta.dimensions.countries},
    {label:"Besoin",key:"needs",options:meta.dimensions.needs},
    {label:"Responsable",key:"assignees",options:meta.dimensions.assignees},
    {label:"Source",key:"sources",options:meta.dimensions.sources},
  ];

  const params = useMemo(()=>{
    const p=new URLSearchParams();
    if(filters.query.trim())p.set("q",filters.query.trim());
    for(const [key,value] of [["statuses",filters.statuses],["countries",filters.countries],["needs",filters.needs],["assignees",filters.assignees],["sources",filters.sources],["tagIds",filters.tagIds]] as const){if(value.length)p.set(key,value.join(","))}
    if(filters.minValue)p.set("minValue",filters.minValue);if(filters.maxValue)p.set("maxValue",filters.maxValue);
    return p.toString();
  },[filters]);

  async function loadMeta(){
    const response=await fetch("/api/admin/crm/segments",{cache:"no-store"});
    if(response.status===401){location.href="/admin/login";return}
    const payload=await response.json().catch(()=>({}));
    if(response.ok)setMeta(payload as Meta);
  }

  async function loadLeads(){
    setLoading(true);
    const response=await fetch(`/api/admin/leads${params?`?${params}`:""}`,{cache:"no-store"});
    if(response.status===401){location.href="/admin/login";return}
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){setNotice(payload.error??"Impossible de charger le CRM.");setLoading(false);return}
    const rows=(payload.leads??[]) as Lead[];
    setLeads(rows);
    setSelectedIds((current)=>current.filter((id)=>rows.some((lead)=>lead.id===id)));
    const requested=new URLSearchParams(window.location.search).get("lead");
    const target=(requested?rows.find((lead)=>lead.id===requested):undefined)??(selected?rows.find((lead)=>lead.id===selected.id):undefined);
    if(target)choose(target); else if(selected&&!rows.some((lead)=>lead.id===selected.id))setSelected(null);
    setLoading(false);
  }

  useEffect(()=>{void loadMeta()},[]);
  useEffect(()=>{const timer=setTimeout(()=>void loadLeads(),180);return()=>clearTimeout(timer)},[params]);

  async function loadRelations(leadId:string){
    const [activityResponse,taskResponse]=await Promise.all([
      fetch(`/api/admin/crm/activities?leadId=${encodeURIComponent(leadId)}`,{cache:"no-store"}),
      fetch(`/api/admin/crm/tasks?leadId=${encodeURIComponent(leadId)}`,{cache:"no-store"}),
    ]);
    const activityPayload=await activityResponse.json().catch(()=>({}));const taskPayload=await taskResponse.json().catch(()=>({}));
    if(activityResponse.ok)setActivities(activityPayload.activities??[]);if(taskResponse.ok)setTasks(taskPayload.tasks??[]);
  }

  function choose(lead:Lead){
    setSelected(lead);setForm({firstName:lead.first_name,lastName:lead.last_name,email:lead.email,phone:lead.phone??"",company:lead.company??"",roleTitle:lead.role_title??"",need:lead.need,source:lead.source,status:lead.status,assignedTo:lead.assigned_to??"",dealValue:lead.deal_value==null?"":String(lead.deal_value),country:lead.country??"",city:lead.city??"",message:lead.message??"",notes:lead.notes??""});setTaskForm((current)=>({...current,assignedTo:lead.assigned_to??""}));void loadRelations(lead.id);
  }
  function createLead(){setSelected(null);setForm(emptyLead);setActivities([]);setTasks([]);setNotice("")}

  async function saveLead(event:FormEvent){
    event.preventDefault();setNotice("Enregistrement…");
    const response=await fetch("/api/admin/leads",{method:selected?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,id:selected?.id,dealValue:form.dealValue===""?null:Number(form.dealValue)})});
    const payload=await response.json().catch(()=>({}));if(!response.ok){setNotice(payload.error??"Enregistrement impossible.");return}
    setNotice("Prospect enregistré.");await loadLeads();if(payload.lead)choose({...payload.lead,tags:selected?.tags??[]} as Lead);
  }

  async function deleteLead(){if(!selected||!confirm("Supprimer définitivement ce prospect et son historique commercial ?"))return;const response=await fetch(`/api/admin/leads?id=${encodeURIComponent(selected.id)}`,{method:"DELETE"});if(response.ok){createLead();await loadLeads()}}

  async function bulk(){
    if(!selectedIds.length)return;setNotice("Action groupée en cours…");
    const body:Record<string,unknown>={ids:selectedIds,action:bulkAction};
    if(bulkAction==="status")body.status=bulkValue;
    if(bulkAction==="assign")body.assignedTo=bulkValue;
    if(bulkAction==="add_tag"||bulkAction==="remove_tag")body.tagId=bulkValue;
    if(bulkAction==="create_task"){body.title=bulkTask.title;body.dueAt=bulkTask.dueAt?new Date(bulkTask.dueAt).toISOString():null;body.priority=bulkTask.priority;body.notes=bulkTask.notes}
    if(bulkAction==="add_note"){body.summary=bulkTask.title;body.body=bulkTask.notes}
    const response=await fetch("/api/admin/crm/bulk",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({}));
    if(!response.ok){setNotice(payload.error??"Action impossible.");return}
    setNotice(`${payload.affected??selectedIds.length} prospect(s) mis à jour.`);setSelectedIds([]);await Promise.all([loadLeads(),loadMeta()]);
  }

  async function saveSegment(){
    if(!segmentName.trim()){setNotice("Donnez un nom au segment.");return}
    const response=await fetch("/api/admin/crm/segments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entity:"segment",name:segmentName,filters,viewConfig:{view,sort:"updated_desc"},visibility:segmentPrivate?"private":"team",isPinned:false})});
    const payload=await response.json().catch(()=>({}));if(!response.ok){setNotice(payload.error??"Impossible d’enregistrer le segment.");return}
    setSaveSegmentOpen(false);setSegmentName("");setNotice("Vue enregistrée dans les segments.");await loadMeta();
  }

  async function deleteSegment(segment:Segment){if(!confirm(`Supprimer le segment « ${segment.name} » ?`))return;const response=await fetch(`/api/admin/crm/segments?entity=segment&id=${encodeURIComponent(segment.id)}`,{method:"DELETE"});if(response.ok)await loadMeta()}
  function applySegment(segment:Segment){setFilters({...emptyFilters,...segment.filters});setView(segment.view_config?.view==="pipeline"?"pipeline":"list");setSelectedIds([])}

  async function createTag(){
    if(!tagName.trim())return;const response=await fetch("/api/admin/crm/segments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entity:"tag",name:tagName,color:tagColor})});const payload=await response.json().catch(()=>({}));if(!response.ok){setNotice(payload.error??"Création du tag impossible.");return}setTagName("");await loadMeta();
  }

  async function toggleLeadTag(tag:Tag){
    if(!selected)return;
    const action=selected.tags.some((item)=>item.id===tag.id)?"remove_tag":"add_tag";
    const response=await fetch("/api/admin/crm/bulk",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:[selected.id],action,tagId:tag.id})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){setNotice(payload.error??"Modification du tag impossible.");return}
    await loadLeads();
  }

  async function addActivity(event:FormEvent){event.preventDefault();if(!selected||!activityForm.summary.trim())return;const response=await fetch("/api/admin/crm/activities",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({leadId:selected.id,...activityForm})});if(response.ok){setActivityForm({kind:"note",summary:"",body:""});await loadRelations(selected.id);await loadLeads()}}
  async function addTask(event:FormEvent){event.preventDefault();if(!selected||!taskForm.title.trim())return;const response=await fetch("/api/admin/crm/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({leadId:selected.id,...taskForm,dueAt:taskForm.dueAt?new Date(taskForm.dueAt).toISOString():null})});if(response.ok){setTaskForm({title:"",dueAt:"",priority:"normal",assignedTo:selected.assigned_to??"",notes:""});await loadRelations(selected.id)}}
  async function completeTask(task:Task){const response=await fetch("/api/admin/crm/tasks",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:task.id,status:task.status==="done"?"todo":"done"})});if(response.ok&&selected)await loadRelations(selected.id)}

  function exportCsv(){
    const rows=(selectedIds.length?leads.filter((lead)=>selectedIds.includes(lead.id)):leads);
    const header=["Prénom","Nom","E-mail","Téléphone","Entreprise","Besoin","Pays","Ville","Responsable","Étape","Valeur","Source","Tags"];
    const lines=[header.map(csvEscape).join(","),...rows.map((lead)=>[lead.first_name,lead.last_name,lead.email,lead.phone,lead.company,lead.need,lead.country,lead.city,lead.assigned_to,lead.status,lead.deal_value,lead.source,lead.tags.map((tag)=>tag.name).join(" | ")].map(csvEscape).join(","))];
    const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=`moony-crm-${new Date().toISOString().slice(0,10)}.csv`;anchor.click();URL.revokeObjectURL(url);
  }

  const pipelineValue=useMemo(()=>leads.filter((lead)=>lead.status!=="lost").reduce((sum,lead)=>sum+Number(lead.deal_value||0),0),[leads]);
  const activeFilterCount=filters.statuses.length+filters.countries.length+filters.needs.length+filters.assignees.length+filters.sources.length+filters.tagIds.length+(filters.minValue?1:0)+(filters.maxValue?1:0)+(filters.query?1:0);
  const allSelected=Boolean(leads.length)&&leads.every((lead)=>selectedIds.includes(lead.id));

  return <AdminWorkspace active="CRM" title="CRM & segmentation" subtitle="Pipeline, listes intelligentes, tags, vues sauvegardées et actions groupées pour piloter les partenariats et ventes complexes." actions={<><button onClick={()=>void Promise.all([loadLeads(),loadMeta()])} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm"><RefreshCw size={14}/> Actualiser</button><button onClick={createLead} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white"><Plus size={15}/> Ajouter un lead</button></>}>
    {notice?<div className="mb-4 rounded-xl border border-[#d8bda9] bg-[#fff8f2] px-4 py-3 text-xs text-[#6f351f]">{notice}</div>:null}
    {!meta.tagsAvailable||!meta.segmentsAvailable?<div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Appliquez la migration CRM V2 pour activer les tags et segments sauvegardés. Le pipeline classique reste disponible.</div>:null}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Prospects affichés",leads.length],["Pipeline",money(pipelineValue)],["Signés",leads.filter((lead)=>lead.status==="won").length],["Sélection",selectedIds.length]].map(([label,value])=><article key={String(label)} className="admin-card admin-shadow p-5"><p className="text-xs text-[#5b2f22]/45">{label}</p><p className="moony-serif mt-2 text-4xl">{loading?"…":value}</p></article>)}</div>

    <section className="admin-card admin-shadow mt-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={()=>setFilters(emptyFilters)} className={`rounded-full px-3 py-2 text-xs ${activeFilterCount===0?"bg-[#7e3518] text-white":"bg-[#f7eee8] text-[#6f351f]"}`}>Tous</button>
        {meta.segments.map((segment)=><div key={segment.id} className="group flex items-center rounded-full bg-[#f7eee8]"><button onClick={()=>applySegment(segment)} className="px-3 py-2 text-xs text-[#6f351f]">{segment.is_pinned?"★ ":""}{segment.name}{segment.visibility==="private"?" · privé":""}</button><button onClick={()=>void deleteSegment(segment)} className="hidden pr-2 text-[#7e3518]/55 group-hover:block" title="Supprimer"><X size={12}/></button></div>)}
        <button onClick={()=>setSaveSegmentOpen((value)=>!value)} className="inline-flex items-center gap-1 rounded-full border border-[#5b2f22]/10 px-3 py-2 text-xs"><Save size={12}/> Enregistrer la vue</button>
        <div className="ml-auto flex rounded-lg border border-[#5b2f22]/10 bg-white p-1"><button onClick={()=>setView("list")} className={`rounded-md p-2 ${view==="list"?"bg-[#ead1bf] text-[#7e3518]":"text-[#5b2f22]/45"}`} title="Liste"><List size={15}/></button><button onClick={()=>setView("pipeline")} className={`rounded-md p-2 ${view==="pipeline"?"bg-[#ead1bf] text-[#7e3518]":"text-[#5b2f22]/45"}`} title="Pipeline"><Columns3 size={15}/></button></div>
      </div>
      {saveSegmentOpen?<div className="mt-3 grid gap-2 rounded-xl bg-[#fffaf6] p-3 md:grid-cols-[1fr_auto_auto]"><input value={segmentName} onChange={(event)=>setSegmentName(event.target.value)} placeholder="Nom du segment, ex. Partenaires Sénégal" className="rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs outline-none"/><label className="flex items-center gap-2 px-2 text-xs"><input type="checkbox" checked={segmentPrivate} onChange={(event)=>setSegmentPrivate(event.target.checked)}/> Vue privée</label><button onClick={()=>void saveSegment()} className="rounded-lg bg-[#7e3518] px-4 py-2 text-xs text-white">Enregistrer</button></div>:null}
    </section>

    <section className="admin-card admin-shadow mt-4 p-4">
      <div className="flex flex-wrap gap-2"><div className="relative min-w-[240px] flex-1"><Search size={14} className="absolute left-3 top-3 text-[#5b2f22]/35"/><input value={filters.query} onChange={(event)=>setFilters({...filters,query:event.target.value})} placeholder="Nom, entreprise, e-mail, téléphone…" className="w-full rounded-lg border border-[#5b2f22]/10 bg-white py-2.5 pl-9 pr-3 text-xs outline-none"/></div><button onClick={()=>setFiltersOpen((value)=>!value)} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/10 px-4 py-2.5 text-xs"><Filter size={14}/> Filtres {activeFilterCount?`(${activeFilterCount})`:""}</button><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/10 px-4 py-2.5 text-xs"><Download size={14}/> Exporter</button></div>
      {filtersOpen?<div className="mt-4 grid gap-3 lg:grid-cols-4">
        <div className="lg:col-span-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.12em] text-[#5b2f22]/42">Étapes</p><div className="flex flex-wrap gap-1.5">{stages.map(([value,label])=><button key={value} onClick={()=>setFilters({...filters,statuses:toggle(filters.statuses,value)})} className={`rounded-full px-3 py-1.5 text-[10px] ${filters.statuses.includes(value)?"bg-[#7e3518] text-white":"bg-[#f7eee8] text-[#6f351f]"}`}>{label}</button>)}</div></div>
        {dimensionFilters.map(({label,key,options})=><label key={key} className="text-xs">{label}<select value={filters[key][0]??""} onChange={(event)=>setFilters({...filters,[key]:event.target.value?[event.target.value]:[]})} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5"><option value="">Tous</option>{options.map((option)=><option key={option} value={option}>{option}</option>)}</select></label>)}
        <label className="text-xs">Valeur min.<input type="number" value={filters.minValue} onChange={(event)=>setFilters({...filters,minValue:event.target.value})} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5"/></label><label className="text-xs">Valeur max.<input type="number" value={filters.maxValue} onChange={(event)=>setFilters({...filters,maxValue:event.target.value})} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5"/></label>
        <div className="lg:col-span-2"><p className="mb-2 text-xs">Tags</p><div className="flex flex-wrap gap-1.5">{meta.tags.map((tag)=><button key={tag.id} onClick={()=>setFilters({...filters,tagIds:toggle(filters.tagIds,tag.id)})} className={`rounded-full border px-3 py-1.5 text-[10px] ${filters.tagIds.includes(tag.id)?"text-white":"bg-white"}`} style={filters.tagIds.includes(tag.id)?{backgroundColor:tag.color,borderColor:tag.color}:{borderColor:`${tag.color}55`,color:tag.color}}>{tag.name}</button>)}</div></div>
        <div className="lg:col-span-4 flex justify-end"><button onClick={()=>setFilters(emptyFilters)} className="text-xs text-[#7e3518]">Réinitialiser tous les filtres</button></div>
      </div>:null}
    </section>

    {selectedIds.length?<section className="sticky top-3 z-20 mt-4 rounded-xl border border-[#7e3518]/20 bg-[#fff8f2] p-3 shadow-lg"><div className="flex flex-wrap items-center gap-2"><strong className="mr-2 text-sm">{selectedIds.length} sélectionné(s)</strong><select value={bulkAction} onChange={(event)=>{setBulkAction(event.target.value);setBulkValue("")}} className="rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs"><option value="status">Changer l’étape</option><option value="assign">Assigner</option><option value="add_tag">Ajouter un tag</option><option value="remove_tag">Retirer un tag</option><option value="create_task">Créer une tâche</option><option value="add_note">Ajouter une note</option></select>{bulkAction==="status"?<select value={bulkValue} onChange={(event)=>setBulkValue(event.target.value)} className="rounded-lg border bg-white px-3 py-2 text-xs"><option value="">Choisir…</option>{stages.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>:null}{bulkAction==="assign"?<input value={bulkValue} onChange={(event)=>setBulkValue(event.target.value)} placeholder="Responsable" className="rounded-lg border px-3 py-2 text-xs"/>:null}{bulkAction==="add_tag"||bulkAction==="remove_tag"?<select value={bulkValue} onChange={(event)=>setBulkValue(event.target.value)} className="rounded-lg border bg-white px-3 py-2 text-xs"><option value="">Choisir un tag…</option>{meta.tags.map((tag)=><option key={tag.id} value={tag.id}>{tag.name}</option>)}</select>:null}{bulkAction==="create_task"||bulkAction==="add_note"?<><input value={bulkTask.title} onChange={(event)=>setBulkTask({...bulkTask,title:event.target.value})} placeholder={bulkAction==="create_task"?"Titre de la tâche":"Résumé de la note"} className="rounded-lg border px-3 py-2 text-xs"/>{bulkAction==="create_task"?<input type="datetime-local" value={bulkTask.dueAt} onChange={(event)=>setBulkTask({...bulkTask,dueAt:event.target.value})} className="rounded-lg border px-3 py-2 text-xs"/>:null}</>:null}<button onClick={()=>void bulk()} disabled={(bulkAction==="status"||bulkAction==="add_tag"||bulkAction==="remove_tag")&&!bulkValue} className="rounded-lg bg-[#7e3518] px-4 py-2 text-xs text-white disabled:opacity-40">Appliquer</button><button onClick={()=>setSelectedIds([])} className="ml-auto p-2 text-[#5b2f22]/50"><X size={15}/></button></div></section>:null}

    {view==="pipeline"?<section className="admin-card admin-shadow mt-4 p-4"><div className="flex gap-3 overflow-x-auto pb-2">{stages.map(([status,label],index)=>{const rows=leads.filter((lead)=>lead.status===status);const total=rows.reduce((sum,lead)=>sum+Number(lead.deal_value||0),0);return <div key={status} className={`min-w-[220px] flex-1 rounded-xl p-3 ${index===6?"bg-[#e3f3e8]":index===7?"bg-[#f8e3e1]":index>=3?"bg-[#fbf0dd]":"bg-[#f7eee8]"}`}><div className="mb-3"><p className="text-xs font-semibold">{label} <span className="font-normal text-[#5b2f22]/42">({rows.length})</span></p><p className="moony-serif mt-1 text-xl">{money(total)}</p></div><div className="space-y-2">{rows.map((lead)=><div key={lead.id} className={`rounded-lg bg-white p-3 shadow-sm ${selected?.id===lead.id?"ring-2 ring-[#b9693d]/40":""}`}><div className="flex gap-2"><input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={()=>setSelectedIds((current)=>toggle(current,lead.id))}/><button onClick={()=>choose(lead)} className="min-w-0 flex-1 text-left"><strong className="block truncate text-[11px]">{lead.company||`${lead.first_name} ${lead.last_name}`}</strong><span className="mt-1 block truncate text-[10px] text-[#5b2f22]/42">{lead.country||"Pays non renseigné"} · {money(Number(lead.deal_value||0))}</span><div className="mt-2 flex flex-wrap gap-1">{lead.tags.slice(0,3).map((tag)=><span key={tag.id} className="rounded-full px-2 py-0.5 text-[8px]" style={{backgroundColor:`${tag.color}18`,color:tag.color}}>{tag.name}</span>)}</div></button></div></div>)}</div></div>})}</div></section>:
    <section className="admin-card admin-shadow mt-4 overflow-hidden"><div className="flex items-center justify-between border-b border-[#5b2f22]/8 px-4 py-3"><div><strong className="text-sm">Liste commerciale</strong><p className="text-[10px] text-[#5b2f22]/42">{leads.length} résultat(s)</p></div><button onClick={()=>setSelectedIds(allSelected?[]:leads.map((lead)=>lead.id))} className="text-xs text-[#7e3518]">{allSelected?"Tout désélectionner":"Tout sélectionner"}</button></div><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-[#fbf7f3] text-[#5b2f22]/45"><tr><th className="px-4 py-3"></th><th>Contact</th><th>Entreprise</th><th>Pays</th><th>Besoin</th><th>Tags</th><th>Responsable</th><th>Valeur</th><th>Étape</th></tr></thead><tbody>{leads.map((lead)=><tr key={lead.id} className={`border-t border-[#5b2f22]/7 hover:bg-[#fffaf6] ${selected?.id===lead.id?"bg-[#f8ece4]":""}`}><td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={()=>setSelectedIds((current)=>toggle(current,lead.id))}/></td><td onClick={()=>choose(lead)} className="cursor-pointer py-3 font-medium">{lead.first_name} {lead.last_name}<span className="block text-[10px] font-normal text-[#5b2f22]/38">{lead.email}</span></td><td>{lead.company||"—"}</td><td>{lead.country||"—"}</td><td>{lead.need}</td><td><div className="flex max-w-[180px] flex-wrap gap-1">{lead.tags.map((tag)=><span key={tag.id} className="rounded-full px-2 py-0.5 text-[8px]" style={{backgroundColor:`${tag.color}18`,color:tag.color}}>{tag.name}</span>)}</div></td><td>{lead.assigned_to||"Non assigné"}</td><td>{money(Number(lead.deal_value||0))}</td><td>{stages.find(([key])=>key===lead.status)?.[1]}</td></tr>)}</tbody></table></div></section>}

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <AdminCard title={selected?"Fiche opportunité":"Nouveau lead"} action={selected?<div className="flex gap-1"><a href={`mailto:${selected.email}`} title="E-mail" className="rounded-lg border border-[#5b2f22]/10 p-2"><Mail size={14}/></a>{selected.phone?<><a href={`tel:${selected.phone}`} title="Appeler" className="rounded-lg border border-[#5b2f22]/10 p-2"><Phone size={14}/></a><a href={whatsApp(selected.phone)} target="_blank" title="WhatsApp" className="rounded-lg border border-[#5b2f22]/10 p-2"><MessageCircle size={14}/></a></>:null}<Link href={`/admin/rendez-vous?lead=${selected.id}`} title="Créer un rendez-vous" className="rounded-lg border border-[#5b2f22]/10 p-2"><CalendarPlus size={14}/></Link></div>:null}>
        <form onSubmit={saveLead} className="space-y-4 text-sm"><div className="grid gap-3 sm:grid-cols-2">{leadTextFields.map(({label,key,type,required})=><label key={key}>{label}<input required={required} type={type??"text"} value={form[key]} onChange={(event)=>setForm({...form,[key]:event.target.value})} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5"/></label>)}<label>Besoin<select value={form.need} onChange={(event)=>setForm({...form,need:event.target.value})} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5">{needValues.map((need)=><option key={need} value={need}>{need}</option>)}</select></label><label>Étape<select value={form.status} onChange={(event)=>setForm({...form,status:event.target.value as Status})} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2.5">{stages.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Valeur de l’opportunité<input type="number" value={form.dealValue} onChange={(event)=>setForm({...form,dealValue:event.target.value})} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5"/></label></div><label className="block">Message<textarea rows={3} value={form.message} onChange={(event)=>setForm({...form,message:event.target.value})} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5"/></label><label className="block">Notes internes<textarea rows={3} value={form.notes} onChange={(event)=>setForm({...form,notes:event.target.value})} className="mt-1 w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5"/></label><div className="flex justify-between gap-2">{selected?<button type="button" onClick={()=>void deleteLead()} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600"><Trash2 size={13}/> Supprimer</button>:<span/>}<button className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white">{selected?"Enregistrer":"Créer le prospect"}</button></div></form>
        {selected?<div className="mt-5 border-t border-[#5b2f22]/8 pt-4"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold">Tags du prospect</p><p className="text-[10px] text-[#5b2f22]/42">Cliquez pour ajouter ou retirer.</p></div><Tags size={15} className="text-[#9d4c27]"/></div><div className="mt-2 flex flex-wrap gap-1.5">{meta.tags.map((tag)=>{const active=selected.tags.some((item)=>item.id===tag.id);return <button key={tag.id} onClick={()=>void toggleLeadTag(tag)} className={`rounded-full border px-3 py-1.5 text-[10px] ${active?"text-white":"bg-white"}`} style={active?{backgroundColor:tag.color,borderColor:tag.color}:{color:tag.color,borderColor:`${tag.color}55`}}>{active?"✓ ":"+ "}{tag.name}</button>})}</div><div className="mt-3 flex gap-2"><input value={tagName} onChange={(event)=>setTagName(event.target.value)} placeholder="Nouveau tag" className="min-w-0 flex-1 rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/><input type="color" value={tagColor} onChange={(event)=>setTagColor(event.target.value)} className="h-9 w-10 rounded border border-[#5b2f22]/10"/><button onClick={()=>void createTag()} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs">Créer</button></div></div>:null}
      </AdminCard>

      <div className="space-y-4">
        <AdminCard title="Activité commerciale"><form onSubmit={addActivity} className="grid gap-2"><select value={activityForm.kind} onChange={(event)=>setActivityForm({...activityForm,kind:event.target.value as Activity["kind"]})} className="rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs">{Object.entries(activityLabels).filter(([key])=>key!=="system"&&key!=="status").map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><input value={activityForm.summary} onChange={(event)=>setActivityForm({...activityForm,summary:event.target.value})} placeholder="Résumé" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/><textarea value={activityForm.body} onChange={(event)=>setActivityForm({...activityForm,body:event.target.value})} placeholder="Détails" rows={2} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/><button disabled={!selected} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#7e3518] px-3 py-2 text-xs text-white disabled:opacity-40"><Send size={12}/> Ajouter à la timeline</button></form><div className="mt-4 max-h-72 space-y-2 overflow-y-auto">{activities.map((activity)=><div key={activity.id} className="rounded-lg bg-[#fffaf6] p-3"><div className="flex items-center gap-2"><span className="rounded-full bg-[#f1dfd2] px-2 py-1 text-[9px] text-[#7e3518]">{activityLabels[activity.kind]}</span><span className="text-[9px] text-[#5b2f22]/35">{dateTime(activity.created_at)}</span></div><strong className="mt-2 block text-xs">{activity.summary}</strong>{activity.body?<p className="mt-1 text-[10px] leading-4 text-[#5b2f22]/55">{activity.body}</p>:null}</div>)}{selected&&!activities.length?<p className="py-6 text-center text-xs text-[#5b2f22]/35">Aucune activité.</p>:null}</div></AdminCard>
        <AdminCard title="Tâches & relances"><form onSubmit={addTask} className="grid gap-2"><input value={taskForm.title} onChange={(event)=>setTaskForm({...taskForm,title:event.target.value})} placeholder="Ex. Relancer la DRH" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/><div className="grid grid-cols-2 gap-2"><input type="datetime-local" value={taskForm.dueAt} onChange={(event)=>setTaskForm({...taskForm,dueAt:event.target.value})} className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/><select value={taskForm.priority} onChange={(event)=>setTaskForm({...taskForm,priority:event.target.value as Task["priority"]})} className="rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs">{Object.entries(priorityLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div><button disabled={!selected} className="rounded-lg border border-[#7e3518]/20 px-3 py-2 text-xs text-[#7e3518] disabled:opacity-40">Créer la relance</button></form><div className="mt-4 space-y-2">{tasks.map((task)=><button key={task.id} onClick={()=>void completeTask(task)} className="flex w-full items-start gap-3 rounded-lg bg-[#fffaf6] p-3 text-left"><span className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full border ${task.status==="done"?"border-emerald-500 bg-emerald-500 text-white":"border-[#9d4c27]/30"}`}>{task.status==="done"?<CheckCircle2 size={12}/>:null}</span><span className="min-w-0 flex-1"><strong className={`block text-xs ${task.status==="done"?"line-through opacity-50":""}`}>{task.title}</strong><span className="mt-1 block text-[9px] text-[#5b2f22]/40">{priorityLabels[task.priority]} · {dateTime(task.due_at)}{task.assigned_to?` · ${task.assigned_to}`:""}</span></span></button>)}{selected&&!tasks.length?<p className="py-6 text-center text-xs text-[#5b2f22]/35">Aucune tâche.</p>:null}</div></AdminCard>
      </div>
    </div>
  </AdminWorkspace>
}
