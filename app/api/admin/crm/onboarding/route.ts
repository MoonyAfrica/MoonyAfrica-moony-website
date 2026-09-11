import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { ensureCrmOnboarding } from "@/lib/crm-onboarding";

async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function nullableText(value:unknown,max=4000){const v=asText(value,max);return v||null}
function isoOrNull(value:unknown){const v=asText(value,80);if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString()}
function dateOnly(value:unknown){const v=asText(value,20);return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:null}
function actor(session:any){return session.name||session.email||"MOONY Admin"}
function relation(value:any){return Array.isArray(value)?value[0]??null:value??null}
async function addEvent(supabase:any,onboardingId:string,eventType:string,title:string,detail:string|null,who:string){await supabase.from("website_crm_onboarding_events").insert({onboarding_id:onboardingId,event_type:eventType,title,detail,actor:who})}

export async function GET(request:Request){
 const {error,supabase}=requireAdmin(request,"crm.read");if(error||!supabase)return error;
 const cases=await supabase.from("website_crm_onboarding_cases").select("*,website_crm_opportunities(id,name,stage,amount,currency,owner,expected_close_date),website_crm_proposals(id,reference,title,total_amount,currency,status,accepted_at),website_leads(id,first_name,last_name,email,company,country,need)").order("created_at",{ascending:false}).limit(300);
 if(cases.error){if(cases.error.code==="42P01")return NextResponse.json({available:false,cases:[],tasks:{},documents:{},contracts:{},events:{},wonWithoutOnboarding:[],metrics:{active:0,blocked:0,live:0,completed:0}});return NextResponse.json({error:cases.error.message},{status:500})}
 const ids=(cases.data??[]).map((row:any)=>row.id);const tasks:Record<string,any[]>={},documents:Record<string,any[]>={},contracts:Record<string,any[]>={},events:Record<string,any[]>={};
 if(ids.length){
  const [taskRows,documentRows,contractRows,eventRows]=await Promise.all([
   supabase.from("website_crm_onboarding_tasks").select("*").in("onboarding_id",ids).order("sort_order",{ascending:true}),
   supabase.from("website_crm_onboarding_documents").select("*").in("onboarding_id",ids).order("created_at",{ascending:true}),
   supabase.from("website_crm_contracts").select("*").in("onboarding_id",ids).order("version",{ascending:false}),
   supabase.from("website_crm_onboarding_events").select("*").in("onboarding_id",ids).order("created_at",{ascending:false}).limit(1000),
  ]);
  for(const row of taskRows.data??[])(tasks[row.onboarding_id]??=[]).push(row);
  for(const row of documentRows.data??[])(documents[row.onboarding_id]??=[]).push(row);
  for(const row of contractRows.data??[])(contracts[row.onboarding_id]??=[]).push(row);
  for(const row of eventRows.data??[])(events[row.onboarding_id]??=[]).push(row);
 }
 const oppIds=new Set((cases.data??[]).map((row:any)=>row.opportunity_id));const won=await supabase.from("website_crm_opportunities").select("id,name,lead_id,owner,amount,currency,website_leads(first_name,last_name,email,company)").eq("stage","won").order("updated_at",{ascending:false}).limit(100);
 const wonWithoutOnboarding=(won.data??[]).filter((row:any)=>!oppIds.has(row.id)).map((row:any)=>({...row,website_leads:relation(row.website_leads)}));
 const rows=(cases.data??[]).map((row:any)=>({...row,website_crm_opportunities:relation(row.website_crm_opportunities),website_crm_proposals:relation(row.website_crm_proposals),website_leads:relation(row.website_leads)}));
 const metrics={active:rows.filter((row:any)=>!["live","completed"].includes(row.status)).length,blocked:rows.filter((row:any)=>row.status==="blocked").length,live:rows.filter((row:any)=>row.status==="live").length,completed:rows.filter((row:any)=>row.status==="completed").length};
 return NextResponse.json({available:true,cases:rows,tasks,documents,contracts,events,wonWithoutOnboarding,metrics});
}

export async function POST(request:Request){
 const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});
 const action=asText(body.action,40),who=actor(session);
 if(action==="ensure"){
  const opportunityId=asText(body.opportunityId,80);if(!opportunityId)return NextResponse.json({error:"Opportunité obligatoire."},{status:422});
  const outcome=await ensureCrmOnboarding(supabase,{opportunityId,proposalId:nullableText(body.proposalId,80),actor:who});if(outcome.available===false)return NextResponse.json({error:"Appliquez la migration CRM V7 pour activer l’onboarding."},{status:409});if(!outcome.case)return NextResponse.json({error:"Le dossier ne peut être créé que pour une opportunité signée."},{status:409});
  await writeAuditLog(supabase,session,"crm.onboarding_ensured","crm_onboarding",outcome.case.id,"Dossier d’onboarding créé ou synchronisé",{opportunityId,created:outcome.created});return NextResponse.json({case:outcome.case,created:outcome.created});
 }
 const onboardingId=asText(body.onboardingId,80);if(!onboardingId)return NextResponse.json({error:"Dossier onboarding obligatoire."},{status:422});
 if(action==="task"){
  const title=asText(body.title,260);if(!title)return NextResponse.json({error:"Titre de tâche obligatoire."},{status:422});const created=await supabase.from("website_crm_onboarding_tasks").insert({onboarding_id:onboardingId,title,category:asText(body.category,60)||"onboarding",status:"todo",required:body.required!==false,owner:nullableText(body.owner,180),due_at:isoOrNull(body.dueAt),notes:nullableText(body.notes,2000),sort_order:Number(body.sortOrder||100)}).select("*").single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});await addEvent(supabase,onboardingId,"task_added","Tâche d’onboarding ajoutée",title,who);await writeAuditLog(supabase,session,"crm.onboarding_task_added","crm_onboarding",onboardingId,`Tâche « ${title} » ajoutée`);return NextResponse.json({task:created.data},{status:201});
 }
 if(action==="document"){
  const name=asText(body.name,260);if(!name)return NextResponse.json({error:"Nom du document obligatoire."},{status:422});const created=await supabase.from("website_crm_onboarding_documents").insert({onboarding_id:onboardingId,name,description:nullableText(body.description,2000),status:"required",required:body.required!==false,due_at:isoOrNull(body.dueAt),document_url:nullableText(body.documentUrl,1200),notes:nullableText(body.notes,2000)}).select("*").single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});await addEvent(supabase,onboardingId,"document_added","Document requis ajouté",name,who);return NextResponse.json({document:created.data},{status:201});
 }
 if(action==="contract_version"){
  const previous=await supabase.from("website_crm_contracts").select("*").eq("onboarding_id",onboardingId).order("version",{ascending:false}).limit(1);const base=previous.data?.[0];if(!base)return NextResponse.json({error:"Aucun contrat de base trouvé."},{status:404});const version=Number(base.version||0)+1;const reference=`MNY-CTR-${new Date().getFullYear()}-${randomUUID().slice(0,8).toUpperCase()}`;const created=await supabase.from("website_crm_contracts").insert({onboarding_id:onboardingId,proposal_id:base.proposal_id,reference,version,title:asText(body.title,260)||base.title,status:"draft",body:nullableText(body.body,30000)||base.body,created_by:who,updated_by:who}).select("*").single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});await addEvent(supabase,onboardingId,"contract_version",`Contrat V${version} créé`,reference,who);return NextResponse.json({contract:created.data},{status:201});
 }
 return NextResponse.json({error:"Action non prise en charge."},{status:422});
}

export async function PATCH(request:Request){
 const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});const entity=asText(body.entity,40),id=asText(body.id,80),who=actor(session);if(!entity||!id)return NextResponse.json({error:"Élément invalide."},{status:422});const now=new Date().toISOString();
 if(entity==="case"){
  const before=await supabase.from("website_crm_onboarding_cases").select("*").eq("id",id).maybeSingle();if(before.error||!before.data)return NextResponse.json({error:"Dossier introuvable."},{status:404});const statuses=new Set(["handoff","contract","documents","kickoff","implementation","live","blocked","completed"]);const patch:Record<string,unknown>={updated_by:who,updated_at:now};if("status" in body&&statuses.has(asText(body.status,40)))patch.status=asText(body.status,40);if("owner" in body)patch.owner=nullableText(body.owner,180);if("kickoffAt" in body)patch.kickoff_at=isoOrNull(body.kickoffAt);if("targetGoLiveDate" in body)patch.target_go_live_date=dateOnly(body.targetGoLiveDate);if("notes" in body)patch.notes=nullableText(body.notes,6000);if(patch.status==="completed")patch.completed_at=now;else if("status" in patch&&before.data.status==="completed")patch.completed_at=null;const updated=await supabase.from("website_crm_onboarding_cases").update(patch).eq("id",id).select("*").single();if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});if(patch.status&&patch.status!==before.data.status)await addEvent(supabase,id,"status_changed","Étape d’onboarding mise à jour",`${before.data.status} → ${patch.status}`,who);await writeAuditLog(supabase,session,"crm.onboarding_updated","crm_onboarding",id,"Dossier d’onboarding mis à jour",patch);return NextResponse.json({case:updated.data});
 }
 if(entity==="task"){
  const before=await supabase.from("website_crm_onboarding_tasks").select("*").eq("id",id).maybeSingle();if(before.error||!before.data)return NextResponse.json({error:"Tâche introuvable."},{status:404});const statuses=new Set(["todo","in_progress","blocked","done"]);const patch:Record<string,unknown>={updated_at:now};if("status" in body&&statuses.has(asText(body.status,40)))patch.status=asText(body.status,40);if("owner" in body)patch.owner=nullableText(body.owner,180);if("dueAt" in body)patch.due_at=isoOrNull(body.dueAt);if("notes" in body)patch.notes=nullableText(body.notes,2000);if(patch.status==="done")patch.completed_at=now;else if("status" in patch)patch.completed_at=null;const updated=await supabase.from("website_crm_onboarding_tasks").update(patch).eq("id",id).select("*").single();if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});if(patch.status&&patch.status!==before.data.status)await addEvent(supabase,before.data.onboarding_id,"task_status",`Tâche ${patch.status==="done"?"terminée":"mise à jour"}`,before.data.title,who);return NextResponse.json({task:updated.data});
 }
 if(entity==="document"){
  const before=await supabase.from("website_crm_onboarding_documents").select("*").eq("id",id).maybeSingle();if(before.error||!before.data)return NextResponse.json({error:"Document introuvable."},{status:404});const statuses=new Set(["required","requested","received","validated","rejected","not_applicable"]);const patch:Record<string,unknown>={updated_at:now};if("status" in body&&statuses.has(asText(body.status,40)))patch.status=asText(body.status,40);if("documentUrl" in body)patch.document_url=nullableText(body.documentUrl,1200);if("dueAt" in body)patch.due_at=isoOrNull(body.dueAt);if("notes" in body)patch.notes=nullableText(body.notes,2000);const updated=await supabase.from("website_crm_onboarding_documents").update(patch).eq("id",id).select("*").single();if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});if(patch.status&&patch.status!==before.data.status)await addEvent(supabase,before.data.onboarding_id,"document_status","Document mis à jour",`${before.data.name} · ${patch.status}`,who);return NextResponse.json({document:updated.data});
 }
 if(entity==="contract"){
  const before=await supabase.from("website_crm_contracts").select("*").eq("id",id).maybeSingle();if(before.error||!before.data)return NextResponse.json({error:"Contrat introuvable."},{status:404});const statuses=new Set(["draft","ready","sent","signed","cancelled"]);const patch:Record<string,unknown>={updated_by:who,updated_at:now};if("title" in body)patch.title=asText(body.title,260)||before.data.title;if("body" in body)patch.body=nullableText(body.body,30000);if("status" in body&&statuses.has(asText(body.status,40)))patch.status=asText(body.status,40);if("effectiveDate" in body)patch.effective_date=dateOnly(body.effectiveDate);if("signedBy" in body)patch.signed_by=nullableText(body.signedBy,180);if("signedByEmail" in body)patch.signed_by_email=nullableText(body.signedByEmail,240);if(patch.status==="sent")patch.sent_at=now;if(patch.status==="signed")patch.signed_at=now;const updated=await supabase.from("website_crm_contracts").update(patch).eq("id",id).select("*").single();if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});if(patch.status&&patch.status!==before.data.status)await addEvent(supabase,before.data.onboarding_id,"contract_status","Contrat mis à jour",`${before.data.reference} · ${before.data.status} → ${patch.status}`,who);await writeAuditLog(supabase,session,"crm.contract_updated","crm_contract",id,`Contrat ${before.data.reference} mis à jour`,{status:patch.status||before.data.status});return NextResponse.json({contract:updated.data});
 }
 return NextResponse.json({error:"Type d’élément non pris en charge."},{status:422});
}
