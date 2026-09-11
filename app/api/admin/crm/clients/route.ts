import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";

function relation(value:any){return Array.isArray(value)?value[0]??null:value??null}
async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function nullable(value:unknown,max=4000){const text=asText(value,max);return text||null}
function dateOnly(value:unknown){const text=asText(value,20);return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:null}
function isoOrNull(value:unknown){const text=asText(value,80);if(!text)return null;const date=new Date(text);return Number.isNaN(date.getTime())?null:date.toISOString()}

export async function GET(request:Request){
  const {error,supabase}=requireAdmin(request,"crm.read");if(error||!supabase)return error;
  const result=await supabase.from("website_crm_client_accounts").select("*,website_leads(id,first_name,last_name,email,company,country,need,source),website_crm_onboarding_cases(id,status,readiness_status,actual_go_live_at,target_go_live_date,kickoff_at),website_crm_opportunities(id,name,amount,currency,owner)").order("activated_at",{ascending:false}).limit(500);
  if(result.error){if(result.error.code==="42P01")return NextResponse.json({available:false,clients:[],metrics:{active:0,paused:0,offboarded:0,reviewsDue:0}});return NextResponse.json({error:result.error.message},{status:500})}
  const now=Date.now();
  const clients=(result.data??[]).map((row:any)=>({...row,website_leads:relation(row.website_leads),website_crm_onboarding_cases:relation(row.website_crm_onboarding_cases),website_crm_opportunities:relation(row.website_crm_opportunities)}));
  const metrics={active:clients.filter((row:any)=>row.status==="active").length,paused:clients.filter((row:any)=>row.status==="paused").length,offboarded:clients.filter((row:any)=>row.status==="offboarded").length,reviewsDue:clients.filter((row:any)=>row.status==="active"&&row.next_success_review_at&&new Date(row.next_success_review_at).getTime()<=now).length};
  return NextResponse.json({available:true,clients,metrics});
}

export async function PATCH(request:Request){
  const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});
  const id=asText(body.id,80);if(!id)return NextResponse.json({error:"Client invalide."},{status:422});
  const before=await supabase.from("website_crm_client_accounts").select("*").eq("id",id).maybeSingle();if(before.error||!before.data)return NextResponse.json({error:"Client introuvable."},{status:404});
  const patch:Record<string,unknown>={updated_by:session.name||session.email||"MOONY Admin",updated_at:new Date().toISOString()};
  if("status" in body){const status=asText(body.status,30);if(!["active","paused","offboarded"].includes(status))return NextResponse.json({error:"Statut client invalide."},{status:422});patch.status=status}
  if("owner" in body)patch.owner=nullable(body.owner,180);
  if("commercialOwner" in body)patch.commercial_owner=nullable(body.commercialOwner,180);
  if("nextSuccessReviewAt" in body)patch.next_success_review_at=isoOrNull(body.nextSuccessReviewAt);
  if("renewalDate" in body)patch.renewal_date=dateOnly(body.renewalDate);
  if("notes" in body)patch.notes=nullable(body.notes,6000);
  const updated=await supabase.from("website_crm_client_accounts").update(patch).eq("id",id).select("*").single();if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});
  await writeAuditLog(supabase,session,"crm.client_updated","crm_client",id,`Client ${before.data.account_name} mis à jour`,patch);
  return NextResponse.json({client:updated.data});
}
