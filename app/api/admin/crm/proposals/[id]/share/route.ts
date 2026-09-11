import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { loadProposalPortalDocument, proposalIsExpired, proposalTokenHash } from "@/lib/crm-proposal-portal";

function escapeHtml(value:string){return value.replace(/[&<>'"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]??char))}
async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function text(value:unknown,max=240){return typeof value==="string"?value.trim().slice(0,max):""}
function money(value:number,currency:string){try{return new Intl.NumberFormat("fr-FR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value||0))}catch{return`${Math.round(Number(value||0)).toLocaleString("fr-FR")} ${currency}`}}

async function sendProposalEmail(email:string,name:string,company:string|null,reference:string,title:string,total:number,currency:string,url:string,validUntil:string|null){
  const apiKey=process.env.BREVO_API_KEY;const senderEmail=process.env.BREVO_SENDER_EMAIL;if(!apiKey||!senderEmail)return false;
  const expiry=validUntil?new Intl.DateTimeFormat("fr-FR",{dateStyle:"long"}).format(new Date(`${validUntil}T12:00:00Z`)):"la date indiquée dans la proposition";
  const response=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"Content-Type":"application/json","api-key":apiKey,accept:"application/json"},body:JSON.stringify({
    sender:{name:process.env.BREVO_SENDER_NAME||"MOONY Africa",email:senderEmail},to:[{email,name:name||company||email}],subject:`Proposition commerciale MOONY · ${reference}`,
    htmlContent:`<div style="margin:0;background:#f8f0e5;padding:34px 18px;color:#5b2f22;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;background:#fffaf4;border:1px solid #ead6c5;border-radius:28px;overflow:hidden"><div style="background:#2d1812;padding:28px 34px;color:#fffaf4"><div style="font-family:Georgia,serif;font-size:30px;letter-spacing:.12em">MOONY</div><div style="margin-top:6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#e9b78f">Proposition commerciale</div></div><div style="padding:34px"><p style="margin-top:0">Bonjour ${escapeHtml(name||company||"")},</p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:30px;line-height:1.15;margin:16px 0;color:#5b2f22">${escapeHtml(title)}</h1><p style="color:#80665d;line-height:1.65">Votre proposition MOONY est disponible dans un espace sécurisé. Vous pourrez la consulter, l’imprimer ou l’enregistrer en PDF, puis l’accepter ou la refuser en ligne.</p><div style="margin:24px 0;padding:18px;border-radius:18px;background:#f3e4d3"><div style="font-size:12px;color:#8b6c5e">Référence</div><strong>${escapeHtml(reference)}</strong><div style="margin-top:12px;font-size:12px;color:#8b6c5e">Montant</div><strong style="font-size:20px">${escapeHtml(money(total,currency))}</strong></div><p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;border-radius:999px;background:#9d4c27;color:#fff;text-decoration:none;padding:14px 22px;font-weight:700">Consulter la proposition</a></p><p style="font-size:12px;color:#927b70;line-height:1.6">Ce lien est personnel et sécurisé. La proposition est valable jusqu’à ${escapeHtml(expiry)}. Ne transférez pas ce lien si vous ne souhaitez pas qu’un tiers puisse consulter ou répondre à la proposition.</p></div></div></div>`
  })});
  return response.ok;
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;
  const {id}=await params;const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});
  const document=await loadProposalPortalDocument(supabase,id);if(!document)return NextResponse.json({error:"Proposition introuvable."},{status:404});
  const proposal=document.proposal;if(proposalIsExpired(proposal.valid_until))return NextResponse.json({error:"Cette proposition est expirée. Créez une nouvelle version avant de l’envoyer."},{status:409});
  if(["accepted","rejected","expired","superseded"].includes(proposal.status))return NextResponse.json({error:"Cette proposition n’est plus envoyable dans son état actuel."},{status:409});
  if(["won","lost"].includes(document.opportunity.stage))return NextResponse.json({error:"Le deal est déjà clôturé. Réouvrez l’opportunité avant d’envoyer une nouvelle proposition."},{status:409});
  const fallbackEmail=document.primaryContact?.email||document.lead?.email||"";const email=(text(body.email)||fallbackEmail).toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json({error:"Renseignez une adresse e-mail client valide."},{status:422});
  const recipientName=text(body.name,180)||document.primaryContact?.name||`${document.lead?.first_name||""} ${document.lead?.last_name||""}`.trim()||document.lead?.company||"Client MOONY";
  if(!process.env.BREVO_API_KEY||!process.env.BREVO_SENDER_EMAIL)return NextResponse.json({error:"Brevo n’est pas configuré pour l’envoi des propositions."},{status:503});
  const token=randomBytes(32).toString("base64url");const now=new Date().toISOString();const origin=process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin;const publicUrl=new URL(`/proposition/${id}`,origin);publicUrl.searchParams.set("token",token);
  const before=await supabase.from("website_crm_proposals").select("status,public_token_hash,public_link_enabled,public_token_issued_at,sent_to_email,sent_at").eq("id",id).maybeSingle();
  const updated=await supabase.from("website_crm_proposals").update({public_token_hash:proposalTokenHash(id,token),public_link_enabled:true,public_token_issued_at:now,sent_to_email:email,sent_at:now,status:"sent",updated_by:session.name||session.email||"MOONY Admin",updated_at:now}).eq("id",id);
  if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});
  const delivered=await sendProposalEmail(email,recipientName,document.lead?.company??null,proposal.reference,proposal.title,proposal.total_amount,proposal.currency,publicUrl.toString(),proposal.valid_until);
  if(!delivered){if(before.data)await supabase.from("website_crm_proposals").update(before.data).eq("id",id);return NextResponse.json({error:"L’e-mail de proposition n’a pas pu être envoyé."},{status:502})}
  await supabase.from("website_crm_proposals").update({last_reminder_at:null,reminder_count:0,viewed_followup_sent_at:null,expiry_reminder_sent_at:null,expired_at:null}).eq("id",id);
  await supabase.from("website_crm_opportunities").update({stage:"proposal",probability:Math.max(.55,Number(document.opportunity.probability||0)),updated_by:session.name||session.email||"MOONY Admin",updated_at:now}).eq("id",document.opportunity.id);
  await supabase.from("website_crm_opportunity_events").insert({opportunity_id:document.opportunity.id,lead_id:document.opportunity.lead_id,event_type:"proposal_sent",title:"Proposition envoyée au client",detail:`${proposal.reference} · ${email}`,actor:session.name||session.email||"MOONY Admin"});
  await writeAuditLog(supabase,session,"crm.proposal_sent","crm_proposal",id,`Proposition ${proposal.reference} envoyée`,{opportunityId:document.opportunity.id,recipient:email});
  return NextResponse.json({ok:true,publicUrl:publicUrl.toString(),recipient:email});
}
