import { createHash, timingSafeEqual } from "node:crypto";

export type ProposalPortalDocument = {
  proposal: {
    id:string; reference:string; version:number; title:string; status:string; currency:string;
    subtotal:number; discount_amount:number; tax_amount:number; total_amount:number; valid_until:string|null;
    introduction:string|null; terms:string|null; sent_at:string|null; viewed_at:string|null;
    accepted_at:string|null; rejected_at:string|null; first_viewed_at:string|null; last_viewed_at:string|null;
    view_count:number; sent_to_email:string|null; responded_at:string|null; response_name:string|null;
    response_email:string|null; response_message:string|null;
  };
  opportunity:{id:string;lead_id:string;name:string;stage:string;probability:number;amount:number;currency:string;expected_close_date:string|null;owner:string|null};
  lead:{id:string;first_name:string;last_name:string;email:string;company:string|null;country:string|null;need:string|null}|null;
  primaryContact:{name:string;email:string|null;role_title:string|null}|null;
  items:Array<{id:string;name:string;description:string|null;quantity:number;unit_price:number;discount_percent:number;total_amount:number;billing_model:string}>;
};

export function proposalTokenHash(proposalId:string, token:string){
  return createHash("sha256").update(`${proposalId}.${token}`).digest("hex");
}

export function verifyProposalToken(proposalId:string, token:string, storedHash:string|null|undefined){
  if(!token || !storedHash) return false;
  const expected=Buffer.from(storedHash,"hex");
  const actual=Buffer.from(proposalTokenHash(proposalId,token),"hex");
  return expected.length===actual.length && timingSafeEqual(expected,actual);
}

export function proposalIsExpired(validUntil:string|null|undefined){
  if(!validUntil)return false;
  const limit=new Date(`${validUntil}T23:59:59.999Z`).getTime();
  return Number.isFinite(limit) && Date.now()>limit;
}

export function effectiveProposalStatus(status:string, validUntil:string|null|undefined){
  if(["accepted","rejected","superseded"].includes(status))return status;
  return proposalIsExpired(validUntil)?"expired":status;
}

function one<T>(value:T|T[]|null|undefined):T|null{return Array.isArray(value)?value[0]??null:value??null}
function numberOf(value:unknown){const n=Number(value);return Number.isFinite(n)?n:0}

export async function loadProposalPortalDocument(supabase:any, proposalId:string):Promise<ProposalPortalDocument|null>{
  const proposalResult=await supabase.from("website_crm_proposals").select("*,website_crm_opportunities(id,lead_id,name,stage,probability,amount,currency,expected_close_date,owner,website_leads(id,first_name,last_name,email,company,country,need))").eq("id",proposalId).maybeSingle();
  if(proposalResult.error||!proposalResult.data)return null;
  const proposal=proposalResult.data;
  const opportunity=one<any>(proposal.website_crm_opportunities);
  if(!opportunity)return null;
  const lead=one<any>(opportunity.website_leads);
  const [itemsResult,contactResult]=await Promise.all([
    supabase.from("website_crm_proposal_items").select("id,name,description,quantity,unit_price,discount_percent,total_amount,billing_model").eq("proposal_id",proposalId).order("sort_order",{ascending:true}),
    supabase.from("website_crm_opportunity_contacts").select("name,email,role_title,is_primary,created_at").eq("opportunity_id",opportunity.id).order("is_primary",{ascending:false}).order("created_at",{ascending:true}).limit(1),
  ]);
  const contact=contactResult.error?null:(contactResult.data?.[0]??null);
  return {
    proposal:{
      id:String(proposal.id),reference:String(proposal.reference),version:Number(proposal.version||1),title:String(proposal.title||"Proposition commerciale"),status:String(proposal.status||"draft"),currency:String(proposal.currency||"XOF"),
      subtotal:numberOf(proposal.subtotal),discount_amount:numberOf(proposal.discount_amount),tax_amount:numberOf(proposal.tax_amount),total_amount:numberOf(proposal.total_amount),valid_until:proposal.valid_until??null,
      introduction:proposal.introduction??null,terms:proposal.terms??null,sent_at:proposal.sent_at??null,viewed_at:proposal.viewed_at??null,accepted_at:proposal.accepted_at??null,rejected_at:proposal.rejected_at??null,
      first_viewed_at:proposal.first_viewed_at??null,last_viewed_at:proposal.last_viewed_at??null,view_count:Number(proposal.view_count||0),sent_to_email:proposal.sent_to_email??null,
      responded_at:proposal.responded_at??null,response_name:proposal.response_name??null,response_email:proposal.response_email??null,response_message:proposal.response_message??null,
    },
    opportunity:{id:String(opportunity.id),lead_id:String(opportunity.lead_id),name:String(opportunity.name||"Opportunité"),stage:String(opportunity.stage||"proposal"),probability:numberOf(opportunity.probability),amount:numberOf(opportunity.amount),currency:String(opportunity.currency||proposal.currency||"XOF"),expected_close_date:opportunity.expected_close_date??null,owner:opportunity.owner??null},
    lead:lead?{id:String(lead.id),first_name:String(lead.first_name||""),last_name:String(lead.last_name||""),email:String(lead.email||""),company:lead.company??null,country:lead.country??null,need:lead.need??null}:null,
    primaryContact:contact?{name:String(contact.name||""),email:contact.email??null,role_title:contact.role_title??null}:null,
    items:(itemsResult.error?[]:(itemsResult.data??[])).map((item:any)=>({id:String(item.id),name:String(item.name||""),description:item.description??null,quantity:numberOf(item.quantity),unit_price:numberOf(item.unit_price),discount_percent:numberOf(item.discount_percent),total_amount:numberOf(item.total_amount),billing_model:String(item.billing_model||"custom")})),
  };
}

export async function syncLeadFromOpportunities(supabase:any, leadId:string){
  const result=await supabase.from("website_crm_opportunities").select("stage,amount,owner,updated_at").eq("lead_id",leadId).order("updated_at",{ascending:false});
  if(result.error||!result.data?.length)return;
  const rows=result.data as Array<{stage:string;amount:number|null;owner:string|null;updated_at:string}>;
  const open=rows.filter((row)=>!["won","lost"].includes(row.stage));
  const won=rows.filter((row)=>row.stage==="won");
  const source=open.length?open:won.length?won:rows;
  const stageOrder:Record<string,number>={new:1,to_contact:2,contacted:3,appointment:4,proposal:5,negotiation:6,won:7,lost:0};
  const status=open.length?[...open].sort((a,b)=>(stageOrder[b.stage]??0)-(stageOrder[a.stage]??0))[0].stage:won.length?"won":"lost";
  const dealValue=source.reduce((sum,row)=>sum+numberOf(row.amount),0);
  const owner=source.find((row)=>row.owner)?.owner??null;
  const patch:Record<string,unknown>={status,deal_value:dealValue,updated_at:new Date().toISOString()};if(owner)patch.assigned_to=owner;
  await supabase.from("website_leads").update(patch).eq("id",leadId);
}
