import { NextResponse } from "next/server";
import { authorizeOnboardingPortal, loadOnboardingPortalDocument, type OnboardingClientProfile } from "@/lib/crm-onboarding-portal";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function json(data:unknown,status=200){const response=NextResponse.json(data,{status});response.headers.set("Cache-Control","no-store, max-age=0");response.headers.set("Referrer-Policy","no-referrer");response.headers.set("X-Robots-Tag","noindex, nofollow");return response}
function clean(value:unknown,max=1000){return typeof value==="string"?value.trim().slice(0,max):""}
async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
async function addEvent(supabase:any,id:string,eventType:string,title:string,detail:string|null,actor:string){await supabase.from("website_crm_onboarding_events").insert({onboarding_id:id,event_type:eventType,title,detail,actor})}
async function notify(supabase:any,id:string,title:string,subtitle:string,severity:"info"|"warning"="info"){
  for(const role of ["founder","admin","sales"]){await supabase.from("control_center_generated_notifications").insert({target_role:role,title,subtitle,href:`/admin/onboarding?case=${id}`,severity,source_type:"crm_onboarding",source_id:`${id}:${title}`})}
}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const supabase=getSupabaseAdmin();if(!supabase)return json({error:"Service indisponible."},503);
  const {id}=await params;const token=new URL(request.url).searchParams.get("token")||"";
  const authorized=await authorizeOnboardingPortal(supabase,id,token);if(!authorized)return json({error:"Lien invalide ou révoqué."},404);
  const state=await supabase.from("website_crm_onboarding_cases").select("client_portal_first_viewed_at,client_portal_view_count").eq("id",id).maybeSingle();
  const now=new Date().toISOString();const first=!state.data?.client_portal_first_viewed_at;
  if(!state.error){
    const patch:Record<string,unknown>={client_portal_last_viewed_at:now,client_portal_view_count:Number(state.data?.client_portal_view_count||0)+1,updated_at:now};if(first)patch.client_portal_first_viewed_at=now;
    await supabase.from("website_crm_onboarding_cases").update(patch).eq("id",id);
    if(first){await addEvent(supabase,id,"client_portal_viewed","Portail onboarding consulté","Première ouverture du portail client sécurisé.","Client");await notify(supabase,id,"Portail onboarding consulté","Le client vient d’ouvrir son espace d’onboarding.")}
  }
  const document=await loadOnboardingPortalDocument(supabase,id);if(!document)return json({error:"Dossier onboarding indisponible."},404);
  return json({document});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const supabase=getSupabaseAdmin();if(!supabase)return json({error:"Service indisponible."},503);
  const {id}=await params;const token=new URL(request.url).searchParams.get("token")||"";
  const authorized=await authorizeOnboardingPortal(supabase,id,token);if(!authorized)return json({error:"Lien invalide ou révoqué."},404);
  const body=await bodyOf(request);if(!body)return json({error:"Requête invalide."},400);
  const action=clean(body.action,40);const now=new Date().toISOString();

  if(action==="profile"){
    const current=await supabase.from("website_crm_onboarding_cases").select("client_profile").eq("id",id).maybeSingle();if(current.error)return json({error:"Impossible de charger vos informations."},500);
    const previous=(current.data?.client_profile??{}) as OnboardingClientProfile;
    const profile:OnboardingClientProfile={...previous,
      legalName:clean(body.legalName,240),registrationNumber:clean(body.registrationNumber,120),billingEmail:clean(body.billingEmail,240),billingAddress:clean(body.billingAddress,1200),
      signatoryName:clean(body.signatoryName,240),signatoryTitle:clean(body.signatoryTitle,180),signatoryEmail:clean(body.signatoryEmail,240),operationsContactName:clean(body.operationsContactName,240),
      operationsContactEmail:clean(body.operationsContactEmail,240),operationsContactPhone:clean(body.operationsContactPhone,80),clientNote:clean(body.clientNote,3000),
    };
    for(const email of [profile.billingEmail,profile.signatoryEmail,profile.operationsContactEmail])if(email&&!/^\S+@\S+\.\S+$/.test(email))return json({error:`Adresse e-mail invalide : ${email}`},422);
    const updated=await supabase.from("website_crm_onboarding_cases").update({client_profile:profile,updated_at:now}).eq("id",id);if(updated.error)return json({error:"Impossible d’enregistrer vos informations."},500);
    await addEvent(supabase,id,"client_profile_updated","Informations client mises à jour","Le client a complété ou modifié ses informations d’onboarding.",profile.operationsContactName||profile.signatoryName||"Client");
    await notify(supabase,id,"Informations onboarding reçues","Le client a mis à jour son profil d’organisation.");
  }else if(action==="kickoff"){
    const response=clean(body.response,40);if(!["confirmed","change_requested"].includes(response))return json({error:"Réponse kickoff invalide."},422);
    const name=clean(body.name,240);if(name.length<2)return json({error:"Indiquez votre nom pour confirmer cette réponse."},422);
    const message=clean(body.message,2000)||null;
    const updated=await supabase.from("website_crm_onboarding_cases").update({kickoff_response:response,kickoff_response_at:now,kickoff_response_name:name,kickoff_response_message:message,updated_at:now}).eq("id",id);if(updated.error)return json({error:"Impossible d’enregistrer votre réponse."},500);
    if(response==="confirmed")await supabase.from("website_crm_onboarding_tasks").update({status:"done",completed_at:now,updated_at:now}).eq("onboarding_id",id).eq("template_key","kickoff-schedule");
    await addEvent(supabase,id,response==="confirmed"?"kickoff_confirmed":"kickoff_change_requested",response==="confirmed"?"Kickoff confirmé par le client":"Modification du kickoff demandée",message,name);
    await notify(supabase,id,response==="confirmed"?"Kickoff confirmé":"Kickoff à replanifier",response==="confirmed"?`${name} a confirmé le rendez-vous de kickoff.`:`${name} demande un ajustement du kickoff.${message?` · ${message}`:""}`,response==="confirmed"?"info":"warning");
  }else return json({error:"Action non prise en charge."},422);

  const document=await loadOnboardingPortalDocument(supabase,id);return json({ok:true,document});
}
