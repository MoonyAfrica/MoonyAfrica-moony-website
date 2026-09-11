import { randomBytes } from "node:crypto";
import { effectiveProposalStatus, loadProposalPortalDocument, proposalIsExpired, proposalTokenHash } from "@/lib/crm-proposal-portal";

const CRM_NOTIFICATION_ROLES = ["founder", "admin", "sales"];

type Settings = {
  auto_reminders:boolean;
  viewed_followup_hours:number;
  expiry_reminder_hours:number;
  max_reminders:number;
};

export type ProposalFollowupSummary = {
  available:boolean;
  settings:Settings;
  expired:number;
  viewedFollowups:number;
  expiryReminders:number;
  notifications:number;
  errors:string[];
};

function escapeHtml(value:string){return value.replace(/[&<>'"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]??char))}
function hoursBetween(from:string|Date,to:string|Date){return (new Date(to).getTime()-new Date(from).getTime())/3600000}
function money(value:number,currency:string){try{return new Intl.NumberFormat("fr-FR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value||0))}catch{return`${Math.round(Number(value||0)).toLocaleString("fr-FR")} ${currency}`}}

export async function notifyCrmProposalEvent(supabase:any,input:{proposalId:string;opportunityId:string;title:string;subtitle:string;severity?:"info"|"warning"|"urgent"}){
  let count=0;
  for(const role of CRM_NOTIFICATION_ROLES){
    const sourceId=`${input.proposalId}:${input.title}`;
    const duplicate=await supabase.from("control_center_generated_notifications").select("id").eq("target_role",role).eq("source_type","crm_proposal").eq("source_id",sourceId).limit(1);
    if(!duplicate.error&&duplicate.data?.length)continue;
    const inserted=await supabase.from("control_center_generated_notifications").insert({target_role:role,title:input.title,subtitle:input.subtitle,href:`/admin/propositions?proposal=${input.proposalId}`,severity:input.severity||"info",source_type:"crm_proposal",source_id:sourceId});
    if(!inserted.error)count+=1;
  }
  return count;
}

async function sendReminderEmail(document:Awaited<ReturnType<typeof loadProposalPortalDocument>>,kind:"viewed"|"expiry",publicUrl:string){
  if(!document)return false;
  const apiKey=process.env.BREVO_API_KEY, senderEmail=process.env.BREVO_SENDER_EMAIL;if(!apiKey||!senderEmail)return false;
  const email=document.proposal.sent_to_email||document.primaryContact?.email||document.lead?.email||"";if(!/^\S+@\S+\.\S+$/.test(email))return false;
  const name=document.primaryContact?.name||`${document.lead?.first_name||""} ${document.lead?.last_name||""}`.trim()||document.lead?.company||"Client MOONY";
  const expiry=document.proposal.valid_until?new Intl.DateTimeFormat("fr-FR",{dateStyle:"long"}).format(new Date(`${document.proposal.valid_until}T12:00:00Z`)):"la date indiquée dans la proposition";
  const viewed=kind==="viewed";
  const subject=viewed?`Suite à votre consultation · ${document.proposal.reference}`:`Votre proposition MOONY expire bientôt · ${document.proposal.reference}`;
  const heading=viewed?"Avez-vous des questions sur notre proposition ?":"Votre proposition arrive bientôt à échéance";
  const body=viewed?"Nous avons vu que vous avez consulté votre proposition MOONY. Si certains éléments doivent être précisés ou ajustés, notre équipe reste disponible avant votre décision.":`Votre proposition MOONY reste disponible jusqu’au ${expiry}. Vous pouvez encore la consulter et répondre directement en ligne.`;
  const response=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"Content-Type":"application/json","api-key":apiKey,accept:"application/json"},body:JSON.stringify({sender:{name:process.env.BREVO_SENDER_NAME||"MOONY Africa",email:senderEmail},to:[{email,name}],subject,htmlContent:`<div style="margin:0;background:#f8f0e5;padding:34px 18px;color:#5b2f22;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;background:#fffaf4;border:1px solid #ead6c5;border-radius:28px;overflow:hidden"><div style="background:#2d1812;padding:28px 34px;color:#fffaf4"><div style="font-family:Georgia,serif;font-size:30px;letter-spacing:.12em">MOONY</div><div style="margin-top:6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#e9b78f">Suivi de proposition</div></div><div style="padding:34px"><p style="margin-top:0">Bonjour ${escapeHtml(name)},</p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:30px;line-height:1.15;margin:16px 0">${escapeHtml(heading)}</h1><p style="color:#80665d;line-height:1.65">${escapeHtml(body)}</p><div style="margin:24px 0;padding:18px;border-radius:18px;background:#f3e4d3"><div style="font-size:12px;color:#8b6c5e">Référence</div><strong>${escapeHtml(document.proposal.reference)}</strong><div style="margin-top:12px;font-size:12px;color:#8b6c5e">Montant</div><strong style="font-size:20px">${escapeHtml(money(document.proposal.total_amount,document.proposal.currency))}</strong></div><p style="margin:28px 0"><a href="${escapeHtml(publicUrl)}" style="display:inline-block;border-radius:999px;background:#9d4c27;color:#fff;text-decoration:none;padding:14px 22px;font-weight:700">Revoir la proposition</a></p><p style="font-size:12px;color:#927b70;line-height:1.6">Ce lien est personnel et sécurisé. Ce rappel génère un nouveau lien : un lien plus ancien peut donc ne plus fonctionner.</p></div></div></div>`})});
  return response.ok;
}

export async function runProposalFollowups(supabase:any):Promise<ProposalFollowupSummary>{
  const defaults:Settings={auto_reminders:false,viewed_followup_hours:48,expiry_reminder_hours:48,max_reminders:2};
  const settingsResult=await supabase.from("website_crm_proposal_followup_settings").select("auto_reminders,viewed_followup_hours,expiry_reminder_hours,max_reminders").eq("id","default").maybeSingle();
  if(settingsResult.error){return{available:false,settings:defaults,expired:0,viewedFollowups:0,expiryReminders:0,notifications:0,errors:[settingsResult.error.message]}}
  const settings:Settings={...defaults,...(settingsResult.data||{})};
  const result=await supabase.from("website_crm_proposals").select("id,opportunity_id,reference,status,valid_until,public_link_enabled,public_token_hash,public_token_issued_at,sent_to_email,first_viewed_at,last_viewed_at,view_count,responded_at,last_reminder_at,reminder_count,viewed_followup_sent_at,expiry_reminder_sent_at,expired_at,website_crm_opportunities(id,lead_id,name)").in("status",["sent","viewed"]).order("updated_at",{ascending:true}).limit(500);
  if(result.error)return{available:true,settings,expired:0,viewedFollowups:0,expiryReminders:0,notifications:0,errors:[result.error.message]};
  let expired=0,viewedFollowups=0,expiryReminders=0,notifications=0;const errors:string[]=[];const now=new Date();const origin=process.env.NEXT_PUBLIC_SITE_URL||"";
  for(const row of result.data??[]){
    const opportunity=Array.isArray(row.website_crm_opportunities)?row.website_crm_opportunities[0]:row.website_crm_opportunities;
    if(!opportunity)continue;
    const effective=effectiveProposalStatus(String(row.status),row.valid_until);
    if(effective==="expired"||proposalIsExpired(row.valid_until)){
      const stamp=now.toISOString();const update=await supabase.from("website_crm_proposals").update({status:"expired",expired_at:stamp,updated_at:stamp}).eq("id",row.id).in("status",["sent","viewed"]);
      if(!update.error){
        expired+=1;await supabase.from("website_crm_opportunity_events").insert({opportunity_id:row.opportunity_id,lead_id:opportunity.lead_id,event_type:"proposal_expired",title:"Proposition expirée",detail:`${row.reference} a atteint sa date de validité.`,actor:"MOONY System"});
        notifications+=await notifyCrmProposalEvent(supabase,{proposalId:String(row.id),opportunityId:String(row.opportunity_id),title:"Proposition expirée",subtitle:`${row.reference} doit être renouvelée ou clôturée.`,severity:"warning"});
      }
      continue;
    }
    if(!settings.auto_reminders||Number(row.reminder_count||0)>=settings.max_reminders||!row.public_link_enabled||!origin||row.responded_at)continue;
    const expiryAt=row.valid_until?new Date(`${row.valid_until}T23:59:59.999Z`):null;
    const hoursUntilExpiry=expiryAt?hoursBetween(now,expiryAt):Number.POSITIVE_INFINITY;
    const needsExpiryReminder=Boolean(expiryAt&&hoursUntilExpiry>0&&hoursUntilExpiry<=settings.expiry_reminder_hours&&!row.expiry_reminder_sent_at);
    const hoursSinceView=row.first_viewed_at?hoursBetween(row.first_viewed_at,now):0;
    const needsViewedFollowup=Boolean(row.first_viewed_at&&hoursSinceView>=settings.viewed_followup_hours&&!row.viewed_followup_sent_at);
    const kind: "viewed"|"expiry"|null = needsExpiryReminder?"expiry":needsViewedFollowup?"viewed":null;
    if(!kind)continue;
    const document=await loadProposalPortalDocument(supabase,String(row.id));if(!document)continue;
    const token=randomBytes(32).toString("base64url");const issuedAt=now.toISOString();const publicUrl=new URL(`/proposition/${row.id}`,origin);publicUrl.searchParams.set("token",token);
    const rotate=await supabase.from("website_crm_proposals").update({public_token_hash:proposalTokenHash(String(row.id),token),public_token_issued_at:issuedAt,updated_at:issuedAt}).eq("id",row.id);
    if(rotate.error){errors.push(`${row.reference}: ${rotate.error.message}`);continue}
    const delivered=await sendReminderEmail(document,kind,publicUrl.toString());
    if(!delivered){
      await supabase.from("website_crm_proposals").update({public_token_hash:row.public_token_hash,public_token_issued_at:row.public_token_issued_at,updated_at:issuedAt}).eq("id",row.id);
      errors.push(`${row.reference}: rappel non délivré`);continue;
    }
    const patch:Record<string,unknown>={last_reminder_at:issuedAt,reminder_count:Number(row.reminder_count||0)+1,updated_at:issuedAt};
    if(kind==="expiry")patch.expiry_reminder_sent_at=issuedAt;else patch.viewed_followup_sent_at=issuedAt;
    await supabase.from("website_crm_proposals").update(patch).eq("id",row.id);
    await supabase.from("website_crm_opportunity_events").insert({opportunity_id:row.opportunity_id,lead_id:opportunity.lead_id,event_type:kind==="expiry"?"proposal_expiry_reminder":"proposal_viewed_followup",title:kind==="expiry"?"Rappel avant expiration envoyé":"Relance après consultation envoyée",detail:`${row.reference} · rappel automatique envoyé à ${document.proposal.sent_to_email||document.primaryContact?.email||document.lead?.email||"client"}.`,actor:"MOONY Automatisation"});
    if(kind==="expiry")expiryReminders+=1;else viewedFollowups+=1;
  }
  return{available:true,settings,expired,viewedFollowups,expiryReminders,notifications,errors};
}
