import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { computeAccountGovernance, syncAccountGovernance } from "@/lib/crm-account-governance";

async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function missing(error:any){return ["42P01","42703"].includes(String(error?.code||""))}
function actor(session:any){return session.name||session.email||"MOONY Admin"}
function nullable(value:unknown,max=5000){const text=asText(value,max);return text||null}
function isoOrNull(value:unknown){const text=asText(value,80);if(!text)return null;const d=new Date(text);return Number.isNaN(d.getTime())?null:d.toISOString()}
function integerOrNull(value:unknown,min:number,max:number){if(value==null||value==="")return null;const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?Math.round(n):null}
function relation(value:any){return Array.isArray(value)?value[0]??null:value??null}

export async function GET(request:Request){
 const {error,supabase}=requireAdmin(request,"crm.read");if(error||!supabase)return error;
 const [clientsResult,stakeholdersResult,interactionsResult]=await Promise.all([
  supabase.from("website_crm_client_accounts").select("id,lead_id,account_name,status,owner,commercial_owner,activated_at,health_score,health_status,governance_score,governance_status,governance_summary,governance_updated_at,website_leads(first_name,last_name,email,company,country)").order("activated_at",{ascending:false}).limit(500),
  supabase.from("website_crm_account_stakeholders").select("*").order("is_primary",{ascending:false}).order("influence",{ascending:true}).order("updated_at",{ascending:false}).limit(5000),
  supabase.from("website_crm_stakeholder_interactions").select("*").order("occurred_at",{ascending:false}).limit(5000),
 ]);
 if(clientsResult.error){if(missing(clientsResult.error))return NextResponse.json({available:false,clients:[],stakeholders:{},interactions:{},metrics:{activeAccounts:0,healthy:0,atRisk:0,critical:0,singleContact:0,dueContacts:0}});return NextResponse.json({error:clientsResult.error.message},{status:500})}
 if(stakeholdersResult.error){if(missing(stakeholdersResult.error))return NextResponse.json({available:false,clients:[],stakeholders:{},interactions:{},metrics:{activeAccounts:0,healthy:0,atRisk:0,critical:0,singleContact:0,dueContacts:0}});return NextResponse.json({error:stakeholdersResult.error.message},{status:500})}
 if(interactionsResult.error&&!missing(interactionsResult.error))return NextResponse.json({error:interactionsResult.error.message},{status:500});
 const stakeholders:Record<string,any[]>={},interactions:Record<string,any[]>={};
 for(const row of stakeholdersResult.data??[])(stakeholders[String(row.client_id)]??=[]).push(row);
 for(const row of interactionsResult.data??[])(interactions[String(row.client_id)]??=[]).push(row);
 const clients=(clientsResult.data??[]).map((row:any)=>{const list=stakeholders[String(row.id)]??[];const governance=computeAccountGovernance(list);return{...row,website_leads:relation(row.website_leads),computedGovernance:governance,stakeholderCount:list.filter((item:any)=>item.is_active!==false).length}});
 const active=clients.filter((row:any)=>row.status==="active"),now=Date.now();
 const metrics={activeAccounts:active.length,healthy:active.filter((row:any)=>row.computedGovernance.status==="healthy").length,atRisk:active.filter((row:any)=>row.computedGovernance.status==="at_risk").length,critical:active.filter((row:any)=>row.computedGovernance.status==="critical").length,singleContact:active.filter((row:any)=>row.stakeholderCount===1).length,dueContacts:(stakeholdersResult.data??[]).filter((row:any)=>row.is_active!==false&&row.next_contact_at&&new Date(row.next_contact_at).getTime()<=now).length};
 return NextResponse.json({available:true,clients,stakeholders,interactions,metrics});
}

export async function POST(request:Request){
 const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});
 const action=asText(body.action,50),who=actor(session),now=new Date().toISOString();
 if(action==="sync"){
  try{const result=await syncAccountGovernance(supabase);await writeAuditLog(supabase,session,"crm.account_governance_sync","crm_account_governance",null,"Gouvernance des comptes recalculée",result);return NextResponse.json(result)}catch(err){return NextResponse.json({error:err instanceof Error?err.message:"Synchronisation impossible."},{status:500})}
 }
 const clientId=asText(body.clientId,80);if(!clientId)return NextResponse.json({error:"Client obligatoire."},{status:422});
 const client=await supabase.from("website_crm_client_accounts").select("id,lead_id,account_name,owner,commercial_owner").eq("id",clientId).maybeSingle();if(client.error||!client.data)return NextResponse.json({error:"Client introuvable ou migration CRM V8.3 non appliquée."},{status:404});
 if(action==="stakeholder_save"){
  const stakeholderId=asText(body.stakeholderId,80),name=asText(body.name,240);if(!name)return NextResponse.json({error:"Nom de l’interlocuteur obligatoire."},{status:422});
  const role=asText(body.stakeholderRole,40)||"other";if(!["executive_sponsor","economic_buyer","champion","influencer","procurement","legal","operational","blocker","user","other"].includes(role))return NextResponse.json({error:"Rôle relationnel invalide."},{status:422});
  const influence=asText(body.influence,20)||"medium";if(!["high","medium","low"].includes(influence))return NextResponse.json({error:"Influence invalide."},{status:422});
  const sentiment=asText(body.sentiment,20)||"unknown";if(!["supportive","neutral","resistant","unknown"].includes(sentiment))return NextResponse.json({error:"Position relationnelle invalide."},{status:422});
  const isPrimary=Boolean(body.isPrimary),cadence=Math.max(1,Math.min(365,Math.round(Number(body.contactCadenceDays||30))||30));
  if(isPrimary)await supabase.from("website_crm_account_stakeholders").update({is_primary:false,updated_at:now,updated_by:who}).eq("client_id",clientId).neq("id",stakeholderId||"00000000-0000-0000-0000-000000000000");
  const row={client_id:clientId,name,email:nullable(body.email,240)?.toLowerCase()||null,phone:nullable(body.phone,80),role_title:nullable(body.roleTitle,240),stakeholder_role:role,influence,sentiment,relationship_strength:integerOrNull(body.relationshipStrength,0,100),is_primary:isPrimary,is_active:body.isActive===false?false:true,contact_cadence_days:cadence,last_contact_at:isoOrNull(body.lastContactAt),next_contact_at:isoOrNull(body.nextContactAt),notes:nullable(body.notes),updated_by:who,updated_at:now};
  let saved;if(stakeholderId)saved=await supabase.from("website_crm_account_stakeholders").update(row).eq("id",stakeholderId).eq("client_id",clientId).select("*").single();else saved=await supabase.from("website_crm_account_stakeholders").insert({...row,created_by:who}).select("*").single();if(saved.error){if(missing(saved.error))return NextResponse.json({error:"Appliquez la migration CRM V8.3 avant de gérer les interlocuteurs."},{status:503});return NextResponse.json({error:saved.error.message},{status:500})}
  await writeAuditLog(supabase,session,"crm.account_stakeholder_saved","crm_account_stakeholder",saved.data.id,`${name} · ${client.data.account_name}`,{clientId,role,influence,sentiment,isPrimary});
  try{await syncAccountGovernance(supabase)}catch{/* stakeholder save remains valid if sync temporarily fails */}
  return NextResponse.json({stakeholder:saved.data});
 }
 if(action==="interaction_add"){
  const stakeholderId=asText(body.stakeholderId,80),summary=asText(body.summary,3000);if(!stakeholderId||!summary)return NextResponse.json({error:"Interlocuteur et résumé obligatoires."},{status:422});const channel=asText(body.channel,20)||"note";if(!["email","call","meeting","whatsapp","note"].includes(channel))return NextResponse.json({error:"Canal invalide."},{status:422});
  const stakeholder=await supabase.from("website_crm_account_stakeholders").select("id,name,contact_cadence_days").eq("id",stakeholderId).eq("client_id",clientId).maybeSingle();if(stakeholder.error||!stakeholder.data)return NextResponse.json({error:"Interlocuteur introuvable."},{status:404});
  const occurred=isoOrNull(body.occurredAt)||now;const next=isoOrNull(body.nextFollowupAt)||new Date(new Date(occurred).getTime()+Number(stakeholder.data.contact_cadence_days||30)*86400000).toISOString();const inserted=await supabase.from("website_crm_stakeholder_interactions").insert({client_id:clientId,stakeholder_id:stakeholderId,channel,summary,outcome:nullable(body.outcome,3000),occurred_at:occurred,next_followup_at:next,created_by:who}).select("*").single();if(inserted.error)return NextResponse.json({error:inserted.error.message},{status:500});await supabase.from("website_crm_account_stakeholders").update({last_contact_at:occurred,next_contact_at:next,updated_by:who,updated_at:now}).eq("id",stakeholderId);
  await supabase.from("website_crm_client_success_events").insert({client_id:clientId,event_type:"note",title:`Interaction · ${stakeholder.data.name}`,detail:summary,actor:who,occurred_at:occurred});await writeAuditLog(supabase,session,"crm.stakeholder_interaction_added","crm_stakeholder_interaction",inserted.data.id,`${stakeholder.data.name} · ${channel}`,{clientId,stakeholderId,nextFollowupAt:next});
  try{await syncAccountGovernance(supabase)}catch{/* interaction remains recorded */}
  return NextResponse.json({interaction:inserted.data,nextFollowupAt:next},{status:201});
 }
 if(action==="followup_task"){
  const stakeholderId=asText(body.stakeholderId,80);const stakeholder=await supabase.from("website_crm_account_stakeholders").select("id,name,influence,next_contact_at").eq("id",stakeholderId).eq("client_id",clientId).maybeSingle();if(stakeholder.error||!stakeholder.data)return NextResponse.json({error:"Interlocuteur introuvable."},{status:404});const due=isoOrNull(body.dueAt)||stakeholder.data.next_contact_at||new Date(Date.now()+86400000).toISOString();const created=await supabase.from("website_crm_tasks").insert({lead_id:client.data.lead_id,title:`Suivi relationnel — ${stakeholder.data.name}`,due_at:due,status:"todo",priority:stakeholder.data.influence==="high"?"high":"normal",assigned_to:client.data.owner||client.data.commercial_owner||who,notes:`Suivi du compte ${client.data.account_name}. Vérifier les derniers échanges et l’objectif du contact avant toute prise de contact.`,metadata:{source:"crm-account-governance",client_id:clientId,stakeholder_id:stakeholderId}}).select("*").single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});await writeAuditLog(supabase,session,"crm.stakeholder_followup_task","crm_task",created.data.id,`Suivi relationnel · ${stakeholder.data.name}`,{clientId,stakeholderId,dueAt:due});return NextResponse.json({task:created.data},{status:201});
 }
 return NextResponse.json({error:"Action non prise en charge."},{status:422});
}
