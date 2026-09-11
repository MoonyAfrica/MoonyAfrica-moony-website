import { NextResponse } from "next/server";
import { requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { hasAdminPermission } from "@/lib/admin-auth";
import { effectiveProposalStatus, proposalIsExpired } from "@/lib/crm-proposal-portal";

function relation(value:any){return Array.isArray(value)?value[0]??null:value??null}
async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function boundedInt(value:unknown,fallback:number,min:number,max:number){const parsed=Math.round(Number(value));return Number.isFinite(parsed)?Math.max(min,Math.min(max,parsed)):fallback}

export async function GET(request:Request){
  const {error,supabase,session}=requireAdmin(request,"crm.read");if(error||!supabase)return error;
  const [result,settingsResult]=await Promise.all([
    supabase.from("website_crm_proposals").select("id,opportunity_id,reference,version,title,status,currency,total_amount,valid_until,created_at,sent_at,viewed_at,accepted_at,rejected_at,public_link_enabled,public_token_issued_at,sent_to_email,first_viewed_at,last_viewed_at,view_count,responded_at,response_name,response_email,response_message,last_reminder_at,reminder_count,viewed_followup_sent_at,expiry_reminder_sent_at,expired_at,website_crm_opportunities(id,lead_id,name,stage,owner,website_leads(id,first_name,last_name,email,company,country))").order("created_at",{ascending:false}).limit(500),
    supabase.from("website_crm_proposal_followup_settings").select("auto_reminders,viewed_followup_hours,expiry_reminder_hours,max_reminders,updated_at,updated_by").eq("id","default").maybeSingle(),
  ]);
  if(result.error){
    if(["42P01","42703"].includes(result.error.code||""))return NextResponse.json({available:false,proposals:[],metrics:{total:0,awaiting:0,viewed:0,accepted:0,expired:0},followupAvailable:false,followupSettings:{autoReminders:false,viewedFollowupHours:48,expiryReminderHours:48,maxReminders:2}});
    return NextResponse.json({error:result.error.message},{status:500});
  }
  const canWrite=hasAdminPermission(session,"crm.write");const rows=[] as any[];const expiredIds:string[]=[];
  for(const proposal of result.data??[]){
    const opportunity=relation(proposal.website_crm_opportunities);const lead=relation(opportunity?.website_leads);const effectiveStatus=effectiveProposalStatus(String(proposal.status),proposal.valid_until);
    if(effectiveStatus==="expired"&&proposal.status!=="expired"&&proposalIsExpired(proposal.valid_until))expiredIds.push(String(proposal.id));
    rows.push({...proposal,effective_status:effectiveStatus,website_crm_opportunities:opportunity?{...opportunity,website_leads:lead}:null});
  }
  if(canWrite&&expiredIds.length)await supabase.from("website_crm_proposals").update({status:"expired",expired_at:new Date().toISOString(),updated_at:new Date().toISOString()}).in("id",expiredIds).in("status",["draft","sent","viewed"]);
  const metrics={total:rows.length,awaiting:rows.filter((row)=>["sent","viewed"].includes(row.effective_status)).length,viewed:rows.filter((row)=>Number(row.view_count||0)>0).length,accepted:rows.filter((row)=>row.effective_status==="accepted").length,expired:rows.filter((row)=>row.effective_status==="expired").length};
  const followupAvailable=!settingsResult.error;
  const settings=settingsResult.data||{auto_reminders:false,viewed_followup_hours:48,expiry_reminder_hours:48,max_reminders:2,updated_at:null,updated_by:null};
  return NextResponse.json({available:true,proposals:rows,metrics,followupAvailable,followupSettings:{autoReminders:Boolean(settings.auto_reminders),viewedFollowupHours:Number(settings.viewed_followup_hours||48),expiryReminderHours:Number(settings.expiry_reminder_hours||48),maxReminders:Number(settings.max_reminders??2),updatedAt:settings.updated_at??null,updatedBy:settings.updated_by??null},integrations:{brevoConfigured:Boolean(process.env.BREVO_API_KEY&&process.env.BREVO_SENDER_EMAIL),cronConfigured:Boolean(process.env.AUTOMATION_CRON_SECRET||process.env.CRON_SECRET)}});
}

export async function PATCH(request:Request){
  const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;
  const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});
  const autoReminders=Boolean(body.autoReminders);const viewedFollowupHours=boundedInt(body.viewedFollowupHours,48,1,720);const expiryReminderHours=boundedInt(body.expiryReminderHours,48,1,720);const maxReminders=boundedInt(body.maxReminders,2,0,10);const now=new Date().toISOString();
  const updated=await supabase.from("website_crm_proposal_followup_settings").upsert({id:"default",auto_reminders:autoReminders,viewed_followup_hours:viewedFollowupHours,expiry_reminder_hours:expiryReminderHours,max_reminders:maxReminders,updated_by:session.name||session.email||"MOONY Admin",updated_at:now},{onConflict:"id"}).select("*").single();
  if(updated.error){if(["42P01","42703"].includes(updated.error.code||""))return NextResponse.json({error:"Appliquez la migration CRM V6.2 pour activer les relances automatiques."},{status:409});return NextResponse.json({error:updated.error.message},{status:500})}
  await writeAuditLog(supabase,session,"crm.proposal_followup_settings_updated","crm_proposal_followups","default","Paramètres de relance des propositions modifiés",{autoReminders,viewedFollowupHours,expiryReminderHours,maxReminders});
  return NextResponse.json({ok:true,settings:{autoReminders,viewedFollowupHours,expiryReminderHours,maxReminders}});
}
