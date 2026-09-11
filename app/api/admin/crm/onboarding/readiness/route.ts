import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { loadOnboardingReadiness } from "@/lib/crm-onboarding-readiness";

async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function actor(session:any){return session.name||session.email||"MOONY Admin"}
function nullable(value:unknown,max=4000){const text=asText(value,max);return text||null}
function relation(value:any){return Array.isArray(value)?value[0]??null:value??null}
async function event(supabase:any,id:string,type:string,title:string,detail:string|null,who:string){await supabase.from("website_crm_onboarding_events").insert({onboarding_id:id,event_type:type,title,detail,actor:who})}
async function notify(supabase:any,id:string,title:string,subtitle:string,severity:"info"|"warning"|"urgent"="info"){
  const now=Date.now();
  for(const role of ["founder","admin","sales"]){await supabase.from("control_center_generated_notifications").insert({target_role:role,title,subtitle,href:`/admin/readiness?case=${id}`,severity,source_type:"crm_onboarding",source_id:`${id}:${title}:${now}`})}
}

export async function GET(request:Request){
  const {error,supabase}=requireAdmin(request,"crm.read");if(error||!supabase)return error;
  const base=await supabase.from("website_crm_onboarding_cases").select("id").order("updated_at",{ascending:false}).limit(200);
  if(base.error){if(["42P01","42703"].includes(base.error.code||""))return NextResponse.json({available:false,items:[],metrics:{pending:0,ready:0,blocked:0,live:0}});return NextResponse.json({error:base.error.message},{status:500})}
  const loaded=await Promise.all((base.data??[]).map((row:any)=>loadOnboardingReadiness(supabase,String(row.id))));
  const items=loaded.filter(Boolean);
  const metrics={pending:items.filter((item:any)=>item.case.readiness_status==="pending").length,ready:items.filter((item:any)=>item.case.readiness_status==="ready").length,blocked:items.filter((item:any)=>item.case.readiness_status==="blocked"||item.case.status==="blocked").length,live:items.filter((item:any)=>item.case.readiness_status==="live"||item.case.status==="live").length};
  return NextResponse.json({available:true,items,metrics});
}

export async function POST(request:Request){
  const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;
  const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});
  const onboardingId=asText(body.onboardingId,80),action=asText(body.action,40),who=actor(session),notes=nullable(body.notes,4000),now=new Date().toISOString();
  if(!onboardingId)return NextResponse.json({error:"Dossier onboarding obligatoire."},{status:422});
  const current=await loadOnboardingReadiness(supabase,onboardingId);if(!current)return NextResponse.json({error:"Dossier onboarding introuvable ou CRM V7.2 non migré."},{status:404});

  if(action==="mark_ready"){
    if(!current.readiness.ready)return NextResponse.json({error:"Le dossier comporte encore des prérequis bloquants.",readiness:current.readiness},{status:409});
    const patch={readiness_status:"ready",readiness_checked_at:now,readiness_checked_by:who,readiness_notes:notes,updated_by:who,updated_at:now};
    const updated=await supabase.from("website_crm_onboarding_cases").update(patch).eq("id",onboardingId);if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});
    await supabase.from("website_crm_onboarding_tasks").update({status:"done",completed_at:now,updated_at:now}).eq("onboarding_id",onboardingId).eq("template_key","go-live-readiness");
    await event(supabase,onboardingId,"readiness_approved","Dossier prêt à lancer",notes,"MOONY · "+who);
    await notify(supabase,onboardingId,"Client prêt à lancer","Tous les prérequis du go-live ont été validés.");
    await writeAuditLog(supabase,session,"crm.onboarding_readiness_approved","crm_onboarding",onboardingId,"Readiness go-live approuvée",{notes});
    return NextResponse.json({ok:true,readinessStatus:"ready"});
  }

  if(action==="block"){
    if(!notes)return NextResponse.json({error:"Précisez le motif du blocage."},{status:422});
    const updated=await supabase.from("website_crm_onboarding_cases").update({status:"blocked",readiness_status:"blocked",readiness_checked_at:now,readiness_checked_by:who,readiness_notes:notes,updated_by:who,updated_at:now}).eq("id",onboardingId);if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});
    await event(supabase,onboardingId,"readiness_blocked","Go-live bloqué",notes,who);await notify(supabase,onboardingId,"Onboarding bloqué",notes,"warning");
    await writeAuditLog(supabase,session,"crm.onboarding_readiness_blocked","crm_onboarding",onboardingId,"Go-live bloqué",{reason:notes});
    return NextResponse.json({ok:true,readinessStatus:"blocked"});
  }

  if(action==="reopen"){
    const updated=await supabase.from("website_crm_onboarding_cases").update({status:"implementation",readiness_status:"pending",readiness_checked_at:null,readiness_checked_by:null,readiness_notes:notes,updated_by:who,updated_at:now}).eq("id",onboardingId);if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});
    await supabase.from("website_crm_onboarding_tasks").update({status:"todo",completed_at:null,updated_at:now}).eq("onboarding_id",onboardingId).eq("template_key","go-live-readiness");
    await event(supabase,onboardingId,"readiness_reopened","Readiness rouverte",notes,who);await writeAuditLog(supabase,session,"crm.onboarding_readiness_reopened","crm_onboarding",onboardingId,"Readiness rouverte");
    return NextResponse.json({ok:true,readinessStatus:"pending"});
  }

  if(action==="review_document"){
    const documentId=asText(body.documentId,80),status=asText(body.status,40);if(!documentId||!["validated","rejected"].includes(status))return NextResponse.json({error:"Document ou décision invalide."},{status:422});
    const document=await supabase.from("website_crm_onboarding_documents").select("id,name,onboarding_id,status").eq("id",documentId).eq("onboarding_id",onboardingId).maybeSingle();if(document.error||!document.data)return NextResponse.json({error:"Document introuvable."},{status:404});
    const updated=await supabase.from("website_crm_onboarding_documents").update({status,notes:notes,updated_at:now}).eq("id",documentId);if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});
    const submission=await supabase.from("website_crm_onboarding_submissions").select("id").eq("document_id",documentId).order("created_at",{ascending:false}).limit(1);
    if(submission.data?.[0])await supabase.from("website_crm_onboarding_submissions").update({status,reviewed_by:who,reviewed_at:now}).eq("id",submission.data[0].id);
    await event(supabase,onboardingId,status==="validated"?"document_validated":"document_rejected",status==="validated"?"Document validé":"Document à corriger",`${document.data.name}${notes?` · ${notes}`:""}`,who);
    if(status==="rejected")await notify(supabase,onboardingId,"Document onboarding à corriger",`${document.data.name}${notes?` · ${notes}`:""}`,"warning");
    await writeAuditLog(supabase,session,"crm.onboarding_document_reviewed","crm_onboarding",onboardingId,`${document.data.name} · ${status}`,{documentId,status});
    return NextResponse.json({ok:true,status});
  }

  if(action==="go_live"){
    const refreshed=await loadOnboardingReadiness(supabase,onboardingId);if(!refreshed)return NextResponse.json({error:"Dossier indisponible."},{status:404});
    if(refreshed.case.readiness_status!=="ready")return NextResponse.json({error:"Le dossier doit d’abord être marqué « Prêt à lancer »."},{status:409});
    if(!refreshed.readiness.ready)return NextResponse.json({error:"Un prérequis a changé depuis la validation readiness.",readiness:refreshed.readiness},{status:409});
    const lead=relation(refreshed.case.website_leads),opportunity=relation(refreshed.case.website_crm_opportunities);const accountName=lead?.company||`${lead?.first_name||""} ${lead?.last_name||""}`.trim()||opportunity?.name||"Client MOONY";
    const updateCase=await supabase.from("website_crm_onboarding_cases").update({status:"live",readiness_status:"live",actual_go_live_at:now,go_live_by:who,go_live_notes:notes,updated_by:who,updated_at:now}).eq("id",onboardingId);if(updateCase.error)return NextResponse.json({error:updateCase.error.message},{status:500});
    const reviewAt=new Date(Date.now()+30*86400000).toISOString();
    const account=await supabase.from("website_crm_client_accounts").upsert({lead_id:refreshed.case.lead_id,onboarding_id:onboardingId,opportunity_id:refreshed.case.opportunity_id,account_name:accountName,status:"active",owner:refreshed.case.owner||null,commercial_owner:refreshed.case.commercial_owner||opportunity?.owner||null,activated_at:now,next_success_review_at:reviewAt,notes:notes,created_by:who,updated_by:who,updated_at:now},{onConflict:"lead_id"}).select("*").single();
    if(account.error){await supabase.from("website_crm_onboarding_cases").update({status:"implementation",readiness_status:"ready",actual_go_live_at:null,go_live_by:null,go_live_notes:null,updated_at:now}).eq("id",onboardingId);return NextResponse.json({error:account.error.message},{status:500})}
    await event(supabase,onboardingId,"go_live","Client mis en service",`${accountName}${notes?` · ${notes}`:""}`,who);await notify(supabase,onboardingId,"Client désormais actif",`${accountName} est passé en production.`);
    await writeAuditLog(supabase,session,"crm.onboarding_go_live","crm_client",account.data.id,`${accountName} passé en client actif`,{onboardingId,activatedAt:now});
    return NextResponse.json({ok:true,readinessStatus:"live",clientAccount:account.data});
  }

  return NextResponse.json({error:"Action non prise en charge."},{status:422});
}
