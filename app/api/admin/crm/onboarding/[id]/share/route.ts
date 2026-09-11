import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { onboardingPortalTokenHash } from "@/lib/crm-onboarding-portal";

function relation(value:any){return Array.isArray(value)?value[0]??null:value??null}
function clean(value:unknown,max=240){return typeof value==="string"?value.trim().slice(0,max):""}
async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function escapeHtml(value:string){return value.replace(/[&<>'"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]??char))}

async function sendInvite(email:string,name:string,client:string,url:string){
 const apiKey=process.env.BREVO_API_KEY;const senderEmail=process.env.BREVO_SENDER_EMAIL;if(!apiKey||!senderEmail)return false;
 const response=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"Content-Type":"application/json","api-key":apiKey,accept:"application/json"},body:JSON.stringify({sender:{name:process.env.BREVO_SENDER_NAME||"MOONY Africa",email:senderEmail},to:[{email,name:name||client||email}],subject:"Votre espace d’onboarding MOONY est prêt",htmlContent:`<div style="margin:0;background:#f8f0e5;padding:34px 18px;color:#5b2f22;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;background:#fffaf4;border:1px solid #ead6c5;border-radius:28px;overflow:hidden"><div style="background:#2d1812;padding:28px 34px;color:#fffaf4"><div style="font-family:Georgia,serif;font-size:30px;letter-spacing:.12em">MOONY</div><div style="margin-top:6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#e9b78f">Onboarding client</div></div><div style="padding:34px"><p style="margin-top:0">Bonjour ${escapeHtml(name||client||"")},</p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:30px;line-height:1.15;margin:16px 0">Bienvenue dans votre espace de démarrage MOONY</h1><p style="color:#80665d;line-height:1.65">Votre espace sécurisé vous permet de compléter les informations de votre organisation, transmettre les documents demandés, suivre les prochaines étapes et confirmer le rendez-vous de kickoff.</p><p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;border-radius:999px;background:#9d4c27;color:#fff;text-decoration:none;padding:14px 22px;font-weight:700">Ouvrir mon espace onboarding</a></p><p style="font-size:12px;color:#927b70;line-height:1.6">Ce lien est personnel et sécurisé. Ne le transférez pas. Un nouvel envoi par l’équipe MOONY invalidera automatiquement le lien précédent.</p></div></div></div>`})});
 return response.ok;
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const {id}=await params;const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});
 const row=await supabase.from("website_crm_onboarding_cases").select("id,status,client_portal_token_hash,client_portal_enabled,client_portal_issued_at,client_portal_email,client_portal_sent_at,website_leads(id,first_name,last_name,email,company),website_crm_opportunities(id,name)").eq("id",id).maybeSingle();
 if(row.error){if(["42P01","42703"].includes(row.error.code||""))return NextResponse.json({error:"Appliquez la migration CRM V7.1 pour activer le portail client."},{status:409});return NextResponse.json({error:row.error.message},{status:500})}if(!row.data)return NextResponse.json({error:"Dossier onboarding introuvable."},{status:404});
 const lead=relation(row.data.website_leads);const email=(clean(body.email)||lead?.email||"").toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json({error:"Renseignez une adresse e-mail client valide."},{status:422});
 if(!process.env.BREVO_API_KEY||!process.env.BREVO_SENDER_EMAIL)return NextResponse.json({error:"Brevo n’est pas configuré pour envoyer l’invitation."},{status:503});
 const recipientName=clean(body.name,180)||`${lead?.first_name||""} ${lead?.last_name||""}`.trim()||lead?.company||"Client MOONY";const client=lead?.company||recipientName;const token=randomBytes(32).toString("base64url");const now=new Date().toISOString();const origin=process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin;const publicUrl=new URL(`/onboarding/${id}`,origin);publicUrl.searchParams.set("token",token);
 const before={client_portal_token_hash:row.data.client_portal_token_hash,client_portal_enabled:row.data.client_portal_enabled,client_portal_issued_at:row.data.client_portal_issued_at,client_portal_email:row.data.client_portal_email,client_portal_sent_at:row.data.client_portal_sent_at};
 const updated=await supabase.from("website_crm_onboarding_cases").update({client_portal_token_hash:onboardingPortalTokenHash(id,token),client_portal_enabled:true,client_portal_issued_at:now,client_portal_sent_at:now,client_portal_email:email,updated_by:session.name||session.email||"MOONY Admin",updated_at:now}).eq("id",id);if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});
 const delivered=await sendInvite(email,recipientName,client,publicUrl.toString());if(!delivered){await supabase.from("website_crm_onboarding_cases").update(before).eq("id",id);return NextResponse.json({error:"L’invitation onboarding n’a pas pu être envoyée."},{status:502})}
 await supabase.from("website_crm_onboarding_events").insert({onboarding_id:id,event_type:"client_portal_sent",title:"Invitation portail client envoyée",detail:email,actor:session.name||session.email||"MOONY Admin"});
 await writeAuditLog(supabase,session,"crm.onboarding_portal_sent","crm_onboarding",id,"Invitation au portail onboarding envoyée",{recipient:email});
 return NextResponse.json({ok:true,recipient:email,publicUrl:publicUrl.toString()});
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const {id}=await params;const now=new Date().toISOString();
 const updated=await supabase.from("website_crm_onboarding_cases").update({client_portal_enabled:false,client_portal_token_hash:null,client_portal_issued_at:null,updated_by:session.name||session.email||"MOONY Admin",updated_at:now}).eq("id",id);if(updated.error){if(updated.error.code==="42703")return NextResponse.json({error:"Appliquez la migration CRM V7.1 pour activer le portail client."},{status:409});return NextResponse.json({error:updated.error.message},{status:500})}
 await supabase.from("website_crm_onboarding_events").insert({onboarding_id:id,event_type:"client_portal_revoked",title:"Accès portail client révoqué",detail:null,actor:session.name||session.email||"MOONY Admin"});
 await writeAuditLog(supabase,session,"crm.onboarding_portal_revoked","crm_onboarding",id,"Accès au portail onboarding révoqué");
 return NextResponse.json({ok:true});
}
