import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { effectiveProposalStatus, loadProposalPortalDocument, proposalIsExpired, syncLeadFromOpportunities, verifyProposalToken } from "@/lib/crm-proposal-portal";

function json(data:unknown,status=200){const response=NextResponse.json(data,{status});response.headers.set("Cache-Control","no-store, max-age=0");response.headers.set("Referrer-Policy","no-referrer");return response}
async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function clean(value:unknown,max=1000){return typeof value==="string"?value.trim().slice(0,max):""}

async function authorizedProposal(supabase:any,id:string,token:string){
  const result=await supabase.from("website_crm_proposals").select("id,public_token_hash,public_link_enabled,status,valid_until,opportunity_id,reference,view_count,first_viewed_at").eq("id",id).maybeSingle();
  if(result.error||!result.data||!result.data.public_link_enabled||!verifyProposalToken(id,token,result.data.public_token_hash))return null;
  return result.data;
}

async function markExpired(supabase:any,proposal:any){
  if(!proposalIsExpired(proposal.valid_until)||["accepted","rejected","expired","superseded"].includes(String(proposal.status)))return proposal;
  const now=new Date().toISOString();
  const updated=await supabase.from("website_crm_proposals").update({status:"expired",updated_at:now}).eq("id",proposal.id).select("*").single();
  if(!updated.error){
    const opportunity=await supabase.from("website_crm_opportunities").select("lead_id").eq("id",proposal.opportunity_id).maybeSingle();
    await supabase.from("website_crm_opportunity_events").insert({opportunity_id:proposal.opportunity_id,lead_id:opportunity.data?.lead_id??null,event_type:"proposal_expired",title:"Proposition expirée",detail:`${proposal.reference} a atteint sa date de validité.`,actor:"MOONY System"});
    return updated.data;
  }
  return {...proposal,status:"expired"};
}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const supabase=getSupabaseAdmin();if(!supabase)return json({error:"Service indisponible."},503);
  const {id}=await params;const token=new URL(request.url).searchParams.get("token")||"";
  let proposal=await authorizedProposal(supabase,id,token);if(!proposal)return json({error:"Lien invalide ou révoqué."},404);
  proposal=await markExpired(supabase,proposal);
  const now=new Date().toISOString();
  const status=effectiveProposalStatus(String(proposal.status),proposal.valid_until);
  if(["sent","viewed"].includes(status)){
    const first=!proposal.first_viewed_at;
    const patch:Record<string,unknown>={status:"viewed",viewed_at:now,last_viewed_at:now,view_count:Number(proposal.view_count||0)+1,updated_at:now};if(first)patch.first_viewed_at=now;
    await supabase.from("website_crm_proposals").update(patch).eq("id",id);
    if(first){
      const opportunity=await supabase.from("website_crm_opportunities").select("lead_id").eq("id",proposal.opportunity_id).maybeSingle();
      await supabase.from("website_crm_opportunity_events").insert({opportunity_id:proposal.opportunity_id,lead_id:opportunity.data?.lead_id??null,event_type:"proposal_viewed",title:"Proposition consultée",detail:`${proposal.reference} a été consultée depuis le portail client.`,actor:"Client"});
    }
  }
  const document=await loadProposalPortalDocument(supabase,id);if(!document)return json({error:"Proposition introuvable."},404);
  document.proposal.status=effectiveProposalStatus(document.proposal.status,document.proposal.valid_until);
  return json({document,canRespond:["sent","viewed"].includes(document.proposal.status)});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const supabase=getSupabaseAdmin();if(!supabase)return json({error:"Service indisponible."},503);
  const {id}=await params;const token=new URL(request.url).searchParams.get("token")||"";
  let proposal=await authorizedProposal(supabase,id,token);if(!proposal)return json({error:"Lien invalide ou révoqué."},404);
  proposal=await markExpired(supabase,proposal);
  if(proposalIsExpired(proposal.valid_until)||String(proposal.status)==="expired")return json({error:"Cette proposition a expiré et ne peut plus être acceptée ou refusée."},409);
  if(["accepted","rejected","superseded"].includes(String(proposal.status)))return json({error:"Une décision a déjà été enregistrée pour cette proposition."},409);
  if(!["sent","viewed"].includes(String(proposal.status)))return json({error:"Cette proposition n’est pas ouverte à la réponse client."},409);
  const body=await bodyOf(request);if(!body)return json({error:"Requête invalide."},400);
  const action=clean(body.action,20);if(!["accept","reject"].includes(action))return json({error:"Action invalide."},422);
  const name=clean(body.name,180);if(name.length<2)return json({error:"Indiquez votre nom pour confirmer votre décision."},422);
  const email=clean(body.email,240)||clean((await supabase.from("website_crm_proposals").select("sent_to_email").eq("id",id).maybeSingle()).data?.sent_to_email,240);
  if(email&&!/^\S+@\S+\.\S+$/.test(email))return json({error:"Adresse e-mail invalide."},422);
  const message=clean(body.message,2000)||null;const now=new Date().toISOString();const accepted=action==="accept";
  const nextStatus=accepted?"accepted":"rejected";
  const patch:Record<string,unknown>={status:nextStatus,responded_at:now,response_name:name,response_email:email||null,response_message:message,response_source:"client_portal",updated_at:now};if(accepted)patch.accepted_at=now;else patch.rejected_at=now;
  const updated=await supabase.from("website_crm_proposals").update(patch).eq("id",id).select("*").single();if(updated.error)return json({error:"Impossible d’enregistrer votre décision."},500);
  const opportunity=await supabase.from("website_crm_opportunities").select("id,lead_id,name,amount").eq("id",proposal.opportunity_id).maybeSingle();
  if(opportunity.data){
    if(accepted){
      await supabase.from("website_crm_opportunities").update({stage:"won",probability:1,amount:Number(updated.data.total_amount||opportunity.data.amount||0),updated_by:"Client portal",updated_at:now}).eq("id",opportunity.data.id);
      await supabase.from("website_crm_proposals").update({status:"superseded",updated_at:now}).eq("opportunity_id",opportunity.data.id).neq("id",id).in("status",["draft","sent","viewed"]);
    }
    await supabase.from("website_crm_opportunity_events").insert({opportunity_id:opportunity.data.id,lead_id:opportunity.data.lead_id,event_type:accepted?"proposal_accepted":"proposal_rejected",title:accepted?"Proposition acceptée par le client":"Proposition refusée par le client",detail:`${proposal.reference} · décision confirmée par ${name}${message?` · ${message}`:""}`,actor:name});
    await syncLeadFromOpportunities(supabase,opportunity.data.lead_id);
  }
  const document=await loadProposalPortalDocument(supabase,id);if(document)document.proposal.status=nextStatus;
  return json({ok:true,status:nextStatus,document});
}
