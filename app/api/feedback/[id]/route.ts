import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncCustomerSuccessHealth } from "@/lib/crm-customer-success";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function json(data:unknown,status=200){const response=NextResponse.json(data,{status});response.headers.set("Cache-Control","no-store, max-age=0");response.headers.set("Referrer-Policy","no-referrer");response.headers.set("X-Robots-Tag","noindex, nofollow");return response}
function clean(value:unknown,max=3000){return typeof value==="string"?value.trim().slice(0,max):""}
async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function hash(id:string,token:string){return createHash("sha256").update(`${id}.${token}`).digest("hex")}
function verify(id:string,token:string,stored:string){try{const expected=Buffer.from(stored,"hex"),actual=Buffer.from(hash(id,token),"hex");return expected.length===actual.length&&timingSafeEqual(expected,actual)}catch{return false}}
function relation(value:any){return Array.isArray(value)?value[0]??null:value??null}

async function authorized(supabase:any,id:string,token:string){
 const result=await supabase.from("website_crm_client_surveys").select("id,client_id,survey_type,status,public_token_hash,sent_to_email,sent_at,expires_at,first_viewed_at,last_viewed_at,view_count,responded_at,score,website_crm_client_accounts(id,account_name,status,website_leads(first_name,last_name))").eq("id",id).maybeSingle();
 if(result.error||!result.data||!token||!verify(id,token,String(result.data.public_token_hash||"")))return null;return result.data;
}
async function notifyDetractor(supabase:any,clientId:string,accountName:string,score:number,comment:string|null){
 const sourceId=`${clientId}:nps:${Date.now()}`;for(const role of ["founder","admin","sales"]){await supabase.from("control_center_generated_notifications").insert({target_role:role,title:"NPS détracteur reçu",subtitle:`${accountName} · ${score}/10${comment?` · ${comment}`:""}`,href:`/admin/customer-success?client=${clientId}`,severity:"warning",source_type:"crm_customer_success",source_id:sourceId})}
}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const supabase=getSupabaseAdmin();if(!supabase)return json({error:"Service indisponible."},503);const {id}=await params;const token=new URL(request.url).searchParams.get("token")||"";const survey=await authorized(supabase,id,token);if(!survey)return json({error:"Lien invalide."},404);
 const account=relation(survey.website_crm_client_accounts);const lead=relation(account?.website_leads);const now=new Date(),nowIso=now.toISOString();
 if(new Date(survey.expires_at).getTime()<now.getTime()&&!['responded','cancelled'].includes(String(survey.status))){await supabase.from("website_crm_client_surveys").update({status:"expired",updated_at:nowIso}).eq("id",id);return json({survey:{id,status:"expired",accountName:account?.account_name||"MOONY",responded:false},expired:true});}
 if(survey.status==="responded")return json({survey:{id,status:"responded",accountName:account?.account_name||"MOONY",responded:true,score:survey.score},responded:true});
 const first=!survey.first_viewed_at;const patch:any={status:"opened",last_viewed_at:nowIso,view_count:Number(survey.view_count||0)+1,updated_at:nowIso};if(first)patch.first_viewed_at=nowIso;await supabase.from("website_crm_client_surveys").update(patch).eq("id",id);
 return json({survey:{id,status:"opened",type:survey.survey_type,accountName:account?.account_name||"Client MOONY",firstName:lead?.first_name||"",expiresAt:survey.expires_at,responded:false}});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const supabase=getSupabaseAdmin();if(!supabase)return json({error:"Service indisponible."},503);const {id}=await params;const token=new URL(request.url).searchParams.get("token")||"";const survey=await authorized(supabase,id,token);if(!survey)return json({error:"Lien invalide."},404);
 const now=new Date(),nowIso=now.toISOString();if(new Date(survey.expires_at).getTime()<now.getTime()){if(survey.status!=="responded")await supabase.from("website_crm_client_surveys").update({status:"expired",updated_at:nowIso}).eq("id",id);return json({error:"Cette enquête a expiré."},409)}
 if(survey.status==="responded")return json({error:"Votre réponse a déjà été enregistrée."},409);
 const body=await bodyOf(request);if(!body)return json({error:"Réponse invalide."},400);const score=Number(body.score);if(!Number.isInteger(score)||score<0||score>10)return json({error:"Choisissez une note entre 0 et 10."},422);const comment=clean(body.comment,3000)||null,respondentName=clean(body.name,240)||null;
 const updated=await supabase.from("website_crm_client_surveys").update({status:"responded",responded_at:nowIso,score,comment,respondent_name:respondentName,updated_at:nowIso}).eq("id",id);if(updated.error)return json({error:"Impossible d’enregistrer votre réponse."},500);
 const account=relation(survey.website_crm_client_accounts);const clientId=String(survey.client_id);await supabase.from("website_crm_client_accounts").update({last_nps_score:score,last_nps_at:nowIso,updated_at:nowIso}).eq("id",clientId);
 await supabase.from("website_crm_client_success_events").insert({client_id:clientId,event_type:"nps",title:`NPS reçu · ${score}/10`,detail:comment,actor:respondentName||"Client",occurred_at:nowIso});
 if(score<=6)await notifyDetractor(supabase,clientId,account?.account_name||"Client MOONY",score,comment);
 try{await syncCustomerSuccessHealth(supabase,[clientId])}catch{/* feedback must remain accepted even when the health sync is temporarily unavailable */}
 return json({ok:true,score,category:score<=6?"detractor":score<=8?"passive":"promoter"});
}
