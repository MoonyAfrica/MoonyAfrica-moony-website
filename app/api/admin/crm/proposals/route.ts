import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { hasAdminPermission } from "@/lib/admin-auth";
import { effectiveProposalStatus, proposalIsExpired } from "@/lib/crm-proposal-portal";

function relation(value:any){return Array.isArray(value)?value[0]??null:value??null}

export async function GET(request:Request){
  const {error,supabase,session}=requireAdmin(request,"crm.read");if(error||!supabase)return error;
  const result=await supabase.from("website_crm_proposals").select("id,opportunity_id,reference,version,title,status,currency,total_amount,valid_until,created_at,sent_at,viewed_at,accepted_at,rejected_at,public_link_enabled,public_token_issued_at,sent_to_email,first_viewed_at,last_viewed_at,view_count,responded_at,response_name,response_email,response_message,website_crm_opportunities(id,lead_id,name,stage,owner,website_leads(id,first_name,last_name,email,company,country))").order("created_at",{ascending:false}).limit(500);
  if(result.error){
    if(["42P01","42703"].includes(result.error.code||""))return NextResponse.json({available:false,proposals:[],metrics:{total:0,awaiting:0,viewed:0,accepted:0,expired:0}});
    return NextResponse.json({error:result.error.message},{status:500});
  }
  const canWrite=hasAdminPermission(session,"crm.write");const rows=[] as any[];const expiredIds:string[]=[];
  for(const proposal of result.data??[]){
    const opportunity=relation(proposal.website_crm_opportunities);const lead=relation(opportunity?.website_leads);const effectiveStatus=effectiveProposalStatus(String(proposal.status),proposal.valid_until);
    if(effectiveStatus==="expired"&&proposal.status!=="expired"&&proposalIsExpired(proposal.valid_until))expiredIds.push(String(proposal.id));
    rows.push({...proposal,effective_status:effectiveStatus,website_crm_opportunities:opportunity?{...opportunity,website_leads:lead}:null});
  }
  if(canWrite&&expiredIds.length)await supabase.from("website_crm_proposals").update({status:"expired",updated_at:new Date().toISOString()}).in("id",expiredIds).in("status",["draft","sent","viewed"]);
  const metrics={total:rows.length,awaiting:rows.filter((row)=>["sent","viewed"].includes(row.effective_status)).length,viewed:rows.filter((row)=>Number(row.view_count||0)>0).length,accepted:rows.filter((row)=>row.effective_status==="accepted").length,expired:rows.filter((row)=>row.effective_status==="expired").length};
  return NextResponse.json({available:true,proposals:rows,metrics});
}
