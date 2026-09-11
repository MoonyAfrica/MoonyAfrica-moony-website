import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { syncCustomerSuccessEscalations } from "@/lib/crm-escalations";

function missing(error:any){return ["42P01","42703"].includes(String(error?.code||""))}
function relation(value:any){return Array.isArray(value)?value[0]??null:value??null}
async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function actor(session:any){return session.name||session.email||"MOONY Admin"}
function nullable(value:unknown,max=8000){const text=asText(value,max);return text||null}
function isoOrNull(value:unknown){const text=asText(value,80);if(!text)return null;const date=new Date(text);return Number.isNaN(date.getTime())?null:date.toISOString()}
function openStatus(status:string){return !["resolved","closed"].includes(status)}

async function loadEscalations(supabase:any){
 const settingsResult=await supabase.from("website_crm_escalation_settings").select("*").eq("id","default").maybeSingle();
 if(settingsResult.error&&missing(settingsResult.error))return{available:false,cases:[],clients:[],settings:null,metrics:{open:0,critical:0,overdue:0,unassigned:0}};
 if(settingsResult.error)throw new Error(settingsResult.error.message);
 const [casesResult,actionsResult,updatesResult,clientsResult]=await Promise.all([
  supabase.from("website_crm_escalation_cases").select("*,website_crm_client_accounts(id,account_name,owner,commercial_owner,portfolio_tier,health_score,health_status,governance_score,governance_status,renewal_date)").order("opened_at",{ascending:false}).limit(500),
  supabase.from("website_crm_escalation_actions").select("*").order("created_at",{ascending:true}).limit(5000),
  supabase.from("website_crm_escalation_updates").select("*").order("created_at",{ascending:false}).limit(5000),
  supabase.from("website_crm_client_accounts").select("id,account_name,owner,commercial_owner,portfolio_tier,health_score,health_status,governance_score,governance_status").eq("status","active").order("account_name",{ascending:true}).limit(1000),
 ]);
 for(const result of [casesResult,actionsResult,updatesResult,clientsResult])if(result.error&&!missing(result.error))throw new Error(result.error.message);
 const actionsByCase:Record<string,any[]>={};for(const row of actionsResult.data??[])(actionsByCase[String(row.escalation_id)]??=[]).push(row);
 const updatesByCase:Record<string,any[]>={};for(const row of updatesResult.data??[])(updatesByCase[String(row.escalation_id)]??=[]).push(row);
 const cases=(casesResult.data??[]).map((raw:any)=>{const account=relation(raw.website_crm_client_accounts);const copy={...raw};delete copy.website_crm_client_accounts;return{...copy,account,actions:actionsByCase[String(raw.id)]??[],updates:updatesByCase[String(raw.id)]??[]}});
 const now=Date.now();const active=cases.filter((row:any)=>openStatus(row.status));
 const metrics={open:active.length,critical:active.filter((row:any)=>row.severity==="critical").length,overdue:active.filter((row:any)=>row.due_at&&new Date(row.due_at).getTime()<now).length,unassigned:active.filter((row:any)=>!row.owner).length};
 return{available:true,cases,clients:clientsResult.data??[],settings:settingsResult.data,metrics};
}

export async function GET(request:Request){const {error,supabase}=requireAdmin(request,"crm.read");if(error||!supabase)return error;try{return NextResponse.json(await loadEscalations(supabase))}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Erreur escalades Customer Success."},{status:500})}}

export async function POST(request:Request){
 const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;
 const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});
 const action=asText(body.action,50),who=actor(session),now=new Date().toISOString();
 if(action==="sync"){
  try{const result=await syncCustomerSuccessEscalations(supabase);await writeAuditLog(supabase,session,"crm.escalation_sync","crm_escalation",null,`Synchronisation escalades · ${result.created} créée(s)`,result);return NextResponse.json({result})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Synchronisation impossible."},{status:500})}
 }
 if(action==="create_case"){
  const clientId=asText(body.clientId,80),title=asText(body.title,320),severity=asText(body.severity,30)||"high";if(!clientId||!title||!["medium","high","critical"].includes(severity))return NextResponse.json({error:"Client, titre et sévérité valides obligatoires."},{status:422});
  const account=await supabase.from("website_crm_client_accounts").select("id,account_name,owner,commercial_owner").eq("id",clientId).maybeSingle();if(account.error||!account.data)return NextResponse.json({error:"Compte client introuvable."},{status:404});
  const defaultHours=severity==="critical"?24:severity==="high"?72:168;const dueAt=isoOrNull(body.dueAt)||new Date(Date.now()+defaultHours*3600000).toISOString();
  const inserted=await supabase.from("website_crm_escalation_cases").insert({client_id:clientId,source_type:"manual",source_key:`manual:${randomUUID()}`,title,summary:nullable(body.summary),severity,status:"open",owner:nullable(body.owner,240)||account.data.owner||account.data.commercial_owner||null,executive_owner:nullable(body.executiveOwner,240),due_at:dueAt,next_review_at:isoOrNull(body.nextReviewAt),source_snapshot:{manual:true},created_by:who,updated_by:who}).select("id").single();
  if(inserted.error)return NextResponse.json({error:inserted.error.message},{status:500});
  await supabase.from("website_crm_escalation_updates").insert({escalation_id:inserted.data.id,update_type:"note",body:"Escalade ouverte manuellement dans le Control Center.",actor:who});
  await writeAuditLog(supabase,session,"crm.escalation_created","crm_escalation",inserted.data.id,`${account.data.account_name} · ${title}`,{severity,dueAt});return NextResponse.json({id:inserted.data.id});
 }
 if(action==="update_case"){
  const id=asText(body.id,80);if(!id)return NextResponse.json({error:"Escalade obligatoire."},{status:422});const patch:Record<string,unknown>={updated_by:who,updated_at:now};
  if(body.status!==undefined){const status=asText(body.status,30);if(!["open","triage","action_plan","monitoring","resolved","closed"].includes(status))return NextResponse.json({error:"Statut invalide."},{status:422});patch.status=status;patch.resolved_at=["resolved","closed"].includes(status)?now:null}
  if(body.severity!==undefined){const severity=asText(body.severity,30);if(!["medium","high","critical"].includes(severity))return NextResponse.json({error:"Sévérité invalide."},{status:422});patch.severity=severity}
  for(const [key,value,max] of [["owner",body.owner,240],["executive_owner",body.executiveOwner,240],["root_cause",body.rootCause,8000],["resolution_summary",body.resolutionSummary,8000],["summary",body.summary,8000]] as const)if(value!==undefined)patch[key]=nullable(value,max);
  if(body.dueAt!==undefined)patch.due_at=isoOrNull(body.dueAt);if(body.nextReviewAt!==undefined)patch.next_review_at=isoOrNull(body.nextReviewAt);
  const saved=await supabase.from("website_crm_escalation_cases").update(patch).eq("id",id).select("id,title,status,severity").single();if(saved.error)return NextResponse.json({error:saved.error.message},{status:500});
  await writeAuditLog(supabase,session,"crm.escalation_updated","crm_escalation",id,`${saved.data.title} · ${saved.data.status}`,{severity:saved.data.severity});return NextResponse.json({ok:true});
 }
 if(action==="add_action"){
  const escalationId=asText(body.escalationId,80),title=asText(body.title,320),priority=asText(body.priority,30)||"high";if(!escalationId||!title||!["normal","high","urgent"].includes(priority))return NextResponse.json({error:"Action d’intervention invalide."},{status:422});
  const inserted=await supabase.from("website_crm_escalation_actions").insert({escalation_id:escalationId,title,detail:nullable(body.detail,4000),owner:nullable(body.owner,240),priority,status:"todo",due_at:isoOrNull(body.dueAt),created_by:who,updated_by:who}).select("id").single();if(inserted.error)return NextResponse.json({error:inserted.error.message},{status:500});
  await writeAuditLog(supabase,session,"crm.escalation_action_created","crm_escalation_action",inserted.data.id,title,{escalationId,priority});return NextResponse.json({id:inserted.data.id});
 }
 if(action==="action_status"){
  const id=asText(body.id,80),status=asText(body.status,30);if(!id||!["todo","in_progress","done","cancelled"].includes(status))return NextResponse.json({error:"Action ou statut invalide."},{status:422});
  const saved=await supabase.from("website_crm_escalation_actions").update({status,completed_at:status==="done"?now:null,updated_by:who,updated_at:now}).eq("id",id).select("id,title,escalation_id").single();if(saved.error)return NextResponse.json({error:saved.error.message},{status:500});
  await writeAuditLog(supabase,session,"crm.escalation_action_status","crm_escalation_action",id,`${saved.data.title} · ${status}`,{escalationId:saved.data.escalation_id});return NextResponse.json({ok:true});
 }
 if(action==="add_update"){
  const escalationId=asText(body.escalationId,80),updateType=asText(body.updateType,30)||"note",text=asText(body.body,8000);if(!escalationId||!text||!["note","decision","risk","progress","resolution"].includes(updateType))return NextResponse.json({error:"Mise à jour invalide."},{status:422});
  const inserted=await supabase.from("website_crm_escalation_updates").insert({escalation_id:escalationId,update_type:updateType,body:text,actor:who}).select("id").single();if(inserted.error)return NextResponse.json({error:inserted.error.message},{status:500});
  await writeAuditLog(supabase,session,"crm.escalation_update_added","crm_escalation_update",inserted.data.id,`${updateType} · ${text.slice(0,120)}`,{escalationId});return NextResponse.json({id:inserted.data.id});
 }
 if(action==="settings"){
  const critical=Number(body.criticalSlaHours),high=Number(body.highSlaHours);if(!Number.isFinite(critical)||critical<1||critical>336||!Number.isFinite(high)||high<1||high>720)return NextResponse.json({error:"SLA invalide."},{status:422});
  const patch={enabled:body.enabled===true,health_critical_enabled:body.healthCriticalEnabled!==false,governance_critical_enabled:body.governanceCriticalEnabled!==false,strategic_risk_enabled:body.strategicRiskEnabled!==false,renewal_overdue_enabled:body.renewalOverdueEnabled!==false,retention_urgent_enabled:body.retentionUrgentEnabled!==false,critical_sla_hours:critical,high_sla_hours:high,updated_by:who,updated_at:now};
  const saved=await supabase.from("website_crm_escalation_settings").upsert({id:"default",...patch},{onConflict:"id"}).select("*").single();if(saved.error)return NextResponse.json({error:saved.error.message},{status:500});
  await writeAuditLog(supabase,session,"crm.escalation_settings","crm_escalation_settings","default",`Automatisation escalades ${saved.data.enabled?"activée":"désactivée"}`,{critical,high});return NextResponse.json({settings:saved.data});
 }
 return NextResponse.json({error:"Action non prise en charge."},{status:422});
}
