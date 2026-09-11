import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { loadCustomerSuccessData, syncCustomerSuccessHealth } from "@/lib/crm-customer-success";

async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function nullable(value:unknown,max=4000){const text=asText(value,max);return text||null}
function isoOrNull(value:unknown){const text=asText(value,80);if(!text)return null;const date=new Date(text);return Number.isNaN(date.getTime())?null:date.toISOString()}
function dateOnly(value:unknown){const text=asText(value,20);return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:null}
function actor(session:any){return session.name||session.email||"MOONY Admin"}
function escapeHtml(value:string){return value.replace(/[&<>'"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]??char))}
function tokenHash(id:string,token:string){return createHash("sha256").update(`${id}.${token}`).digest("hex")}

async function event(supabase:any,clientId:string,eventType:string,title:string,detail:string|null,who:string,scoreDelta?:number|null){await supabase.from("website_crm_client_success_events").insert({client_id:clientId,event_type:eventType,title,detail,actor:who,score_delta:scoreDelta??null})}

async function sendNps(email:string,name:string,accountName:string,url:string){
 const apiKey=process.env.BREVO_API_KEY,senderEmail=process.env.BREVO_SENDER_EMAIL;if(!apiKey||!senderEmail)return false;
 const response=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"Content-Type":"application/json","api-key":apiKey,accept:"application/json"},body:JSON.stringify({sender:{name:process.env.BREVO_SENDER_NAME||"MOONY Africa",email:senderEmail},to:[{email,name:name||accountName||email}],subject:"Votre avis compte pour MOONY",htmlContent:`<div style="margin:0;background:#f8f0e5;padding:34px 18px;color:#5b2f22;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;background:#fffaf4;border:1px solid #ead6c5;border-radius:28px;overflow:hidden"><div style="background:#2d1812;padding:28px 34px;color:#fffaf4"><div style="font-family:Georgia,serif;font-size:30px;letter-spacing:.12em">MOONY</div><div style="margin-top:6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#e9b78f">Customer Success</div></div><div style="padding:34px"><p style="margin-top:0">Bonjour ${escapeHtml(name||"")},</p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:29px;line-height:1.15;margin:16px 0">Comment se passe votre expérience avec MOONY ?</h1><p style="color:#80665d;line-height:1.65">Votre retour nous aide à mieux accompagner ${escapeHtml(accountName)}. La question prend moins d’une minute et porte uniquement sur votre expérience avec MOONY.</p><p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;border-radius:999px;background:#9d4c27;color:#fff;text-decoration:none;padding:14px 22px;font-weight:700">Donner mon avis</a></p><p style="font-size:12px;color:#927b70;line-height:1.6">Ce lien est personnel. Il expire automatiquement après 30 jours.</p></div></div></div>`})});
 return response.ok;
}

export async function GET(request:Request){
 const {error,supabase}=requireAdmin(request,"crm.read");if(error||!supabase)return error;
 try{
  const data=await loadCustomerSuccessData(supabase);if(!data.available)return NextResponse.json({available:false,accounts:[],events:{},surveys:{},growth:{},metrics:{active:0,healthy:0,watch:0,atRisk:0,critical:0,reviewsDue:0,renewalsSoon:0,npsAverage:null}});
  const now=Date.now(),within45=now+45*86400000;
  const active=data.accounts.filter((row:any)=>row.status==="active");const nps=active.map((row:any)=>row.latestSurvey?.score??row.last_nps_score).filter((value:any)=>value!=null).map(Number);
  const metrics={active:active.length,healthy:active.filter((row:any)=>row.health.status==="healthy").length,watch:active.filter((row:any)=>row.health.status==="watch").length,atRisk:active.filter((row:any)=>row.health.status==="at_risk").length,critical:active.filter((row:any)=>row.health.status==="critical").length,reviewsDue:active.filter((row:any)=>row.next_success_review_at&&new Date(row.next_success_review_at).getTime()<=now).length,renewalsSoon:active.filter((row:any)=>row.renewal_date&&new Date(`${row.renewal_date}T23:59:59`).getTime()>=now&&new Date(`${row.renewal_date}T23:59:59`).getTime()<=within45).length,npsAverage:nps.length?Math.round(nps.reduce((sum:number,value:number)=>sum+value,0)/nps.length*10)/10:null};
  return NextResponse.json({...data,metrics,capabilities:{email:Boolean(process.env.BREVO_API_KEY&&process.env.BREVO_SENDER_EMAIL),cron:Boolean(process.env.AUTOMATION_CRON_SECRET||process.env.CRON_SECRET)}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Impossible de charger Customer Success."},{status:500})}
}

export async function POST(request:Request){
 const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});
 const action=asText(body.action,40),clientId=asText(body.clientId,80),who=actor(session),now=new Date().toISOString();
 if(action==="sync"){
  try{const result=await syncCustomerSuccessHealth(supabase);await writeAuditLog(supabase,session,"crm.customer_success_sync","crm_customer_success",null,"Santé Customer Success recalculée",result);return NextResponse.json(result)}catch(err){return NextResponse.json({error:err instanceof Error?err.message:"Synchronisation impossible."},{status:500})}
 }
 if(!clientId)return NextResponse.json({error:"Client obligatoire."},{status:422});
 const client=await supabase.from("website_crm_client_accounts").select("*,website_leads(first_name,last_name,email,company)").eq("id",clientId).maybeSingle();if(client.error||!client.data)return NextResponse.json({error:"Client introuvable ou migration CRM V8 non appliquée."},{status:404});
 const lead=Array.isArray(client.data.website_leads)?client.data.website_leads[0]:client.data.website_leads;

 if(action==="review"){
  const summary=asText(body.summary,5000);if(!summary)return NextResponse.json({error:"Ajoutez un compte rendu de revue client."},{status:422});
  const nextReview=isoOrNull(body.nextReviewAt)||new Date(Date.now()+30*86400000).toISOString();
  const updated=await supabase.from("website_crm_client_accounts").update({last_success_contact_at:now,next_success_review_at:nextReview,updated_by:who,updated_at:now}).eq("id",clientId);if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});
  await event(supabase,clientId,"review","Revue Customer Success",summary,who);await writeAuditLog(supabase,session,"crm.customer_review","crm_client",clientId,`Revue client · ${client.data.account_name}`,{nextReviewAt:nextReview});await syncCustomerSuccessHealth(supabase,[clientId]);return NextResponse.json({ok:true,nextReviewAt:nextReview});
 }

 if(action==="profile"){
  const patch:Record<string,unknown>={updated_by:who,updated_at:now};
  if("adoptionScore" in body){const value=Number(body.adoptionScore);if(!Number.isFinite(value)||value<0||value>100)return NextResponse.json({error:"Adoption attendue entre 0 et 100."},{status:422});patch.adoption_score=Math.round(value)}
  if("churnRiskNotes" in body)patch.churn_risk_notes=nullable(body.churnRiskNotes,5000);
  if("renewalProbability" in body){const value=Number(body.renewalProbability);if(!Number.isFinite(value)||value<0||value>100)return NextResponse.json({error:"Probabilité de renouvellement attendue entre 0 et 100."},{status:422});patch.renewal_probability=Math.round(value)}
  if("expansionPotential" in body){const value=asText(body.expansionPotential,20);if(!["low","medium","high"].includes(value))return NextResponse.json({error:"Potentiel d’expansion invalide."},{status:422});patch.expansion_potential=value}
  if("nextReviewAt" in body)patch.next_success_review_at=isoOrNull(body.nextReviewAt);
  if("renewalDate" in body)patch.renewal_date=dateOnly(body.renewalDate);
  const updated=await supabase.from("website_crm_client_accounts").update(patch).eq("id",clientId);if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});
  await event(supabase,clientId,"adoption","Profil Customer Success mis à jour",`Adoption ${patch.adoption_score??client.data.adoption_score??"—"}% · renouvellement ${patch.renewal_probability??client.data.renewal_probability??"—"}%`,who);
  await writeAuditLog(supabase,session,"crm.customer_success_profile","crm_client",clientId,`Profil Customer Success · ${client.data.account_name}`,patch);const sync=await syncCustomerSuccessHealth(supabase,[clientId]);return NextResponse.json({ok:true,sync});
 }

 if(action==="send_nps"){
  const email=(asText(body.email,240)||lead?.email||"").toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json({error:"Adresse e-mail client invalide."},{status:422});
  if(!process.env.BREVO_API_KEY||!process.env.BREVO_SENDER_EMAIL)return NextResponse.json({error:"Brevo n’est pas configuré pour envoyer l’enquête NPS."},{status:503});
  const surveyId=randomUUID(),token=randomBytes(32).toString("base64url"),expiresAt=new Date(Date.now()+30*86400000).toISOString();const origin=process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin;const publicUrl=new URL(`/feedback/${surveyId}`,origin);publicUrl.searchParams.set("token",token);
  const inserted=await supabase.from("website_crm_client_surveys").insert({id:surveyId,client_id:clientId,survey_type:"nps",status:"sent",public_token_hash:tokenHash(surveyId,token),sent_to_email:email,sent_at:now,expires_at:expiresAt,created_by:who}).select("id").single();if(inserted.error)return NextResponse.json({error:inserted.error.message},{status:500});
  const name=`${lead?.first_name||""} ${lead?.last_name||""}`.trim();const delivered=await sendNps(email,name,client.data.account_name,publicUrl.toString());if(!delivered){await supabase.from("website_crm_client_surveys").delete().eq("id",surveyId);return NextResponse.json({error:"L’enquête NPS n’a pas pu être envoyée."},{status:502})}
  await event(supabase,clientId,"nps","Enquête NPS envoyée",email,who);await writeAuditLog(supabase,session,"crm.nps_sent","crm_client",clientId,`Enquête NPS envoyée · ${client.data.account_name}`,{recipient:email,surveyId});return NextResponse.json({ok:true,surveyId,recipient:email,publicUrl:publicUrl.toString()});
 }

 if(action==="growth"){
  const kind=asText(body.kind,30),title=asText(body.title,260);if(!["renewal","upsell","cross_sell"].includes(kind)||!title)return NextResponse.json({error:"Type et titre d’opportunité obligatoires."},{status:422});
  const value=Math.max(0,Number(body.estimatedValue||0));const created=await supabase.from("website_crm_client_growth_opportunities").insert({client_id:clientId,kind,status:"open",title,estimated_value:Number.isFinite(value)?value:0,currency:asText(body.currency,10)||"XOF",due_date:dateOnly(body.dueDate),notes:nullable(body.notes,4000),created_by:who,updated_by:who}).select("*").single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});
  await event(supabase,clientId,"expansion",kind==="renewal"?"Renouvellement à travailler":kind==="upsell"?"Opportunité d’upsell créée":"Opportunité de cross-sell créée",title,who);await writeAuditLog(supabase,session,"crm.customer_growth_created","crm_client_growth",created.data.id,title,{clientId,kind});return NextResponse.json({ok:true,growth:created.data},{status:201});
 }

 if(action==="growth_update"){
  const growthId=asText(body.growthId,80),status=asText(body.status,30);if(!growthId||!["open","planned","won","lost","dismissed"].includes(status))return NextResponse.json({error:"Opportunité ou statut invalide."},{status:422});
  const existing=await supabase.from("website_crm_client_growth_opportunities").select("id,title,status").eq("id",growthId).eq("client_id",clientId).maybeSingle();if(existing.error||!existing.data)return NextResponse.json({error:"Opportunité de croissance introuvable."},{status:404});
  const updated=await supabase.from("website_crm_client_growth_opportunities").update({status,updated_by:who,updated_at:now}).eq("id",growthId).select("*").single();if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});
  await event(supabase,clientId,status==="won"?"expansion":"renewal",`Opportunité ${status}`,existing.data.title,who);return NextResponse.json({ok:true,growth:updated.data});
 }
 return NextResponse.json({error:"Action non prise en charge."},{status:422});
}
