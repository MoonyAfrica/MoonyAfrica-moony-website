import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { computePlanProgress } from "@/lib/crm-success-plans";

async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function missing(error:any){return ["42P01","42703"].includes(String(error?.code||""))}
function actor(session:any){return session.name||session.email||"MOONY Admin"}
function nullable(value:unknown,max=8000){const text=asText(value,max);return text||null}
function isoOrNull(value:unknown){const text=asText(value,80);if(!text)return null;const date=new Date(text);return Number.isNaN(date.getTime())?null:date.toISOString()}
function dateOnly(value:unknown){const text=asText(value,20);return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:null}
function int(value:unknown,min:number,max:number,fallback:number){const number=Number(value);return Number.isFinite(number)&&number>=min&&number<=max?Math.round(number):fallback}
function relation(value:any){return Array.isArray(value)?value[0]??null:value??null}
function reviewKey(value:string){return `review:${new Date(value).toISOString().slice(0,10)}`}
async function refreshProgress(supabase:any,planId:string){const result=await supabase.from("website_crm_success_objectives").select("progress,weight").eq("plan_id",planId);if(result.error)throw new Error(result.error.message);const progress=computePlanProgress(result.data??[]);const update=await supabase.from("website_crm_success_plans").update({overall_progress:progress,updated_at:new Date().toISOString()}).eq("id",planId);if(update.error)throw new Error(update.error.message);return progress}

export async function GET(request:Request){
 const {error,supabase}=requireAdmin(request,"crm.read");if(error||!supabase)return error;
 const [clientsResult,plansResult,objectivesResult,qbrsResult,actionsResult]=await Promise.all([
  supabase.from("website_crm_client_accounts").select("id,lead_id,account_name,status,owner,commercial_owner,activated_at,renewal_date,next_success_review_at,health_score,health_status,health_summary,adoption_score,last_nps_score,website_leads(first_name,last_name,email,company,country)").order("activated_at",{ascending:false}).limit(500),
  supabase.from("website_crm_success_plans").select("*").order("updated_at",{ascending:false}).limit(500),
  supabase.from("website_crm_success_objectives").select("*").order("created_at",{ascending:true}).limit(3000),
  supabase.from("website_crm_qbrs").select("*").order("scheduled_at",{ascending:false}).limit(2000),
  supabase.from("website_crm_qbr_actions").select("*").order("created_at",{ascending:true}).limit(3000),
 ]);
 if(plansResult.error){if(missing(plansResult.error))return NextResponse.json({available:false,clients:[],plans:[],objectives:{},qbrs:{},actions:{},metrics:{activePlans:0,objectivesAtRisk:0,reviewsDue:0,completion:0}});return NextResponse.json({error:plansResult.error.message},{status:500})}
 if(clientsResult.error)return NextResponse.json({error:clientsResult.error.message},{status:500});
 for(const result of [objectivesResult,qbrsResult,actionsResult])if(result.error&&!missing(result.error))return NextResponse.json({error:result.error.message},{status:500});
 const objectives:Record<string,any[]>={},qbrs:Record<string,any[]>={},actions:Record<string,any[]>={};
 for(const row of objectivesResult.data??[])(objectives[String(row.plan_id)]??=[]).push(row);
 for(const row of qbrsResult.data??[])(qbrs[String(row.plan_id)]??=[]).push(row);
 for(const row of actionsResult.data??[])(actions[String(row.qbr_id)]??=[]).push(row);
 const clients=(clientsResult.data??[]).map((row:any)=>({...row,website_leads:relation(row.website_leads)}));
 const plans=plansResult.data??[];const now=Date.now();
 const activePlans=plans.filter((row:any)=>row.status==="active").length;
 const objectivesAtRisk=(objectivesResult.data??[]).filter((row:any)=>["at_risk","blocked"].includes(row.status)).length;
 const reviewsDue=plans.filter((row:any)=>row.status==="active"&&row.next_review_at&&new Date(row.next_review_at).getTime()<=now).length;
 const completion=activePlans?Math.round(plans.filter((row:any)=>row.status==="active").reduce((sum:number,row:any)=>sum+Number(row.overall_progress||0),0)/activePlans):0;
 return NextResponse.json({available:true,clients,plans,objectives,qbrs,actions,metrics:{activePlans,objectivesAtRisk,reviewsDue,completion}});
}

export async function POST(request:Request){
 const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});
 const action=asText(body.action,50),who=actor(session),now=new Date().toISOString();

 if(action==="plan_upsert"){
  const clientId=asText(body.clientId,80);if(!clientId)return NextResponse.json({error:"Client obligatoire."},{status:422});
  const client=await supabase.from("website_crm_client_accounts").select("id,account_name,owner,commercial_owner,next_success_review_at").eq("id",clientId).maybeSingle();if(client.error||!client.data)return NextResponse.json({error:"Client introuvable."},{status:404});
  const existing=await supabase.from("website_crm_success_plans").select("*").eq("client_id",clientId).maybeSingle();if(existing.error&&missing(existing.error))return NextResponse.json({error:"Appliquez la migration CRM V8.2 avant de créer un plan de succès."},{status:503});if(existing.error)return NextResponse.json({error:existing.error.message},{status:500});
  const status=asText(body.status,20)||existing.data?.status||"draft";if(!["draft","active","paused","completed"].includes(status))return NextResponse.json({error:"Statut de plan invalide."},{status:422});
  const cadence=int(body.cadenceDays,14,365,Number(existing.data?.cadence_days||90));let nextReview=isoOrNull(body.nextReviewAt)||existing.data?.next_review_at||client.data.next_success_review_at||null;if(status==="active"&&!nextReview)nextReview=new Date(Date.now()+cadence*86400000).toISOString();
  const row={client_id:clientId,title:asText(body.title,260)||existing.data?.title||`Plan de succès · ${client.data.account_name}`,status,success_definition:nullable(body.successDefinition),owner:nullable(body.owner,240)||existing.data?.owner||client.data.owner||client.data.commercial_owner||null,customer_owner:nullable(body.customerOwner,240),start_date:dateOnly(body.startDate)||existing.data?.start_date||now.slice(0,10),target_date:dateOnly(body.targetDate),cadence_days:cadence,next_review_at:nextReview,created_by:existing.data?.created_by||who,updated_by:who,updated_at:now};
  const saved=await supabase.from("website_crm_success_plans").upsert(row,{onConflict:"client_id"}).select("*").single();if(saved.error)return NextResponse.json({error:saved.error.message},{status:500});
  if(nextReview)await supabase.from("website_crm_client_accounts").update({next_success_review_at:nextReview,updated_at:now}).eq("id",clientId);
  await writeAuditLog(supabase,session,"crm.success_plan_saved","crm_success_plan",saved.data.id,`${saved.data.title} · ${status}`,{clientId,cadenceDays:cadence,nextReviewAt:nextReview});
  return NextResponse.json({plan:saved.data});
 }

 if(action==="objective_save"){
  const planId=asText(body.planId,80),objectiveId=asText(body.objectiveId,80),title=asText(body.title,320);if(!planId||!title)return NextResponse.json({error:"Plan et objectif obligatoires."},{status:422});
  const status=asText(body.status,30)||"not_started";if(!["not_started","on_track","at_risk","blocked","achieved"].includes(status))return NextResponse.json({error:"Statut d’objectif invalide."},{status:422});
  const ownerType=asText(body.ownerType,20)||"shared";if(!["moony","client","shared"].includes(ownerType))return NextResponse.json({error:"Responsable d’objectif invalide."},{status:422});
  const row={plan_id:planId,title,description:nullable(body.description),status,progress:int(body.progress,0,100,status==="achieved"?100:0),weight:int(body.weight,1,100,1),current_value:body.currentValue===""||body.currentValue==null?null:Number(body.currentValue),target_value:body.targetValue===""||body.targetValue==null?null:Number(body.targetValue),unit:nullable(body.unit,40),due_date:dateOnly(body.dueDate),owner_type:ownerType,owner_name:nullable(body.ownerName,240),updated_by:who,updated_at:now};
  let saved;if(objectiveId)saved=await supabase.from("website_crm_success_objectives").update(row).eq("id",objectiveId).eq("plan_id",planId).select("*").single();else saved=await supabase.from("website_crm_success_objectives").insert({...row,created_by:who}).select("*").single();if(saved.error)return NextResponse.json({error:saved.error.message},{status:500});
  const progress=await refreshProgress(supabase,planId);await writeAuditLog(supabase,session,"crm.success_objective_saved","crm_success_objective",saved.data.id,title,{planId,status,progress});return NextResponse.json({objective:saved.data,planProgress:progress});
 }

 if(action==="objective_delete"){
  const planId=asText(body.planId,80),objectiveId=asText(body.objectiveId,80);if(!planId||!objectiveId)return NextResponse.json({error:"Objectif invalide."},{status:422});const removed=await supabase.from("website_crm_success_objectives").delete().eq("id",objectiveId).eq("plan_id",planId);if(removed.error)return NextResponse.json({error:removed.error.message},{status:500});const progress=await refreshProgress(supabase,planId);await writeAuditLog(supabase,session,"crm.success_objective_deleted","crm_success_objective",objectiveId,"Objectif du plan de succès supprimé",{planId,progress});return NextResponse.json({ok:true,planProgress:progress});
 }

 if(action==="qbr_prepare"){
  const planId=asText(body.planId,80);if(!planId)return NextResponse.json({error:"Plan obligatoire."},{status:422});const planResult=await supabase.from("website_crm_success_plans").select("*,website_crm_client_accounts(id,account_name,health_score,health_summary,adoption_score,last_nps_score)").eq("id",planId).maybeSingle();if(planResult.error||!planResult.data)return NextResponse.json({error:"Plan introuvable."},{status:404});const account=relation(planResult.data.website_crm_client_accounts);if(!account)return NextResponse.json({error:"Compte client introuvable."},{status:404});
  const scheduled=isoOrNull(body.scheduledAt)||planResult.data.next_review_at||new Date(Date.now()+7*86400000).toISOString();const key=reviewKey(scheduled);const existing=await supabase.from("website_crm_qbrs").select("*").eq("plan_id",planId).eq("review_key",key).maybeSingle();if(existing.data)return NextResponse.json({qbr:existing.data,existing:true});
  const qbr=await supabase.from("website_crm_qbrs").insert({client_id:account.id,plan_id:planId,review_key:key,status:"preparing",scheduled_at:scheduled,period_start:dateOnly(planResult.data.last_review_at)||planResult.data.start_date,period_end:scheduled.slice(0,10),executive_summary:`Revue de succès · ${account.account_name}. Complétez les résultats, décisions et prochaines étapes.`,risks:account.health_summary||null,adoption_snapshot:account.adoption_score??null,nps_snapshot:account.last_nps_score??null,health_snapshot:account.health_score??null,prepared_at:now,created_by:who,updated_by:who}).select("*").single();if(qbr.error)return NextResponse.json({error:qbr.error.message},{status:500});await writeAuditLog(supabase,session,"crm.qbr_prepared","crm_qbr",qbr.data.id,`Revue préparée · ${account.account_name}`,{planId,scheduledAt:scheduled});return NextResponse.json({qbr:qbr.data},{status:201});
 }

 if(action==="qbr_save"){
  const qbrId=asText(body.qbrId,80);if(!qbrId)return NextResponse.json({error:"Revue obligatoire."},{status:422});const existing=await supabase.from("website_crm_qbrs").select("*,website_crm_success_plans(cadence_days,client_id)").eq("id",qbrId).maybeSingle();if(existing.error||!existing.data)return NextResponse.json({error:"Revue introuvable."},{status:404});const status=asText(body.status,20)||existing.data.status;if(!["planned","preparing","completed","cancelled"].includes(status))return NextResponse.json({error:"Statut de revue invalide."},{status:422});
  const scheduled=isoOrNull(body.scheduledAt)||existing.data.scheduled_at;const patch:any={status,scheduled_at:scheduled,executive_summary:nullable(body.executiveSummary),wins:nullable(body.wins),risks:nullable(body.risks),decisions:nullable(body.decisions),next_steps:nullable(body.nextSteps),updated_by:who,updated_at:now};if(status==="completed")patch.completed_at=now;const saved=await supabase.from("website_crm_qbrs").update(patch).eq("id",qbrId).select("*").single();if(saved.error)return NextResponse.json({error:saved.error.message},{status:500});
  if(status==="completed"){
   const plan=relation(existing.data.website_crm_success_plans);const cadence=Number(plan?.cadence_days||90),next=new Date(Date.now()+cadence*86400000).toISOString();await supabase.from("website_crm_success_plans").update({last_review_at:now,next_review_at:next,updated_by:who,updated_at:now}).eq("id",existing.data.plan_id);await supabase.from("website_crm_client_accounts").update({last_success_contact_at:now,next_success_review_at:next,updated_at:now}).eq("id",existing.data.client_id);await supabase.from("website_crm_client_success_events").insert({client_id:existing.data.client_id,event_type:"review",title:"Revue client terminée",detail:patch.executive_summary||"Revue de succès complétée.",actor:who});
  }
  await writeAuditLog(supabase,session,"crm.qbr_saved","crm_qbr",qbrId,`Revue client · ${status}`,{planId:existing.data.plan_id,clientId:existing.data.client_id});return NextResponse.json({qbr:saved.data});
 }

 if(action==="qbr_action_save"){
  const qbrId=asText(body.qbrId,80),itemId=asText(body.itemId,80),title=asText(body.title,320);if(!qbrId||!title)return NextResponse.json({error:"Revue et action obligatoires."},{status:422});const status=asText(body.status,20)||"open";if(!["open","done","cancelled"].includes(status))return NextResponse.json({error:"Statut d’action invalide."},{status:422});const row:any={qbr_id:qbrId,title,owner_name:nullable(body.ownerName,240),due_date:dateOnly(body.dueDate),status,updated_by:who,updated_at:now,completed_at:status==="done"?now:null};let saved;if(itemId)saved=await supabase.from("website_crm_qbr_actions").update(row).eq("id",itemId).eq("qbr_id",qbrId).select("*").single();else saved=await supabase.from("website_crm_qbr_actions").insert({...row,created_by:who}).select("*").single();if(saved.error)return NextResponse.json({error:saved.error.message},{status:500});await writeAuditLog(supabase,session,"crm.qbr_action_saved","crm_qbr_action",saved.data.id,title,{qbrId,status});return NextResponse.json({item:saved.data});
 }

 if(action==="qbr_action_delete"){
  const qbrId=asText(body.qbrId,80),itemId=asText(body.itemId,80);if(!qbrId||!itemId)return NextResponse.json({error:"Action invalide."},{status:422});const removed=await supabase.from("website_crm_qbr_actions").delete().eq("id",itemId).eq("qbr_id",qbrId);if(removed.error)return NextResponse.json({error:removed.error.message},{status:500});await writeAuditLog(supabase,session,"crm.qbr_action_deleted","crm_qbr_action",itemId,"Action QBR supprimée",{qbrId});return NextResponse.json({ok:true});
 }

 return NextResponse.json({error:"Action non prise en charge."},{status:422});
}
