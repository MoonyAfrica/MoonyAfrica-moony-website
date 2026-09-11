import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { hasAdminPermission } from "@/lib/admin-auth";

type SearchResult={id:string;kind:string;title:string;subtitle:string;href:string};

export async function GET(request:Request){
  const {error,supabase,session}=requireAdmin(request);if(error||!supabase)return error;
  const q=(new URL(request.url).searchParams.get("q")||"").trim().slice(0,120);
  if(q.length<2)return NextResponse.json({results:[]});
  const pattern=`%${q.replace(/[%_]/g,"\\$&")}%`;
  const results:SearchResult[]=[];
  const partialErrors:string[]=[];

  if(hasAdminPermission(session,"crm.read")){
    const response=await supabase.from("website_leads").select("id,first_name,last_name,email,company,status").or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},company.ilike.${pattern}`).limit(5);
    if(response.error)partialErrors.push(response.error.message);
    for(const lead of response.data??[])results.push({id:`lead-${lead.id}`,kind:"CRM",title:lead.company||`${lead.first_name} ${lead.last_name}`,subtitle:`${lead.first_name} ${lead.last_name} · ${lead.email} · ${lead.status}`,href:`/admin/crm?lead=${lead.id}`});

    const opportunities=await supabase.from("website_crm_opportunities").select("id,name,stage,amount,currency,lead_id,owner").or(`name.ilike.${pattern},owner.ilike.${pattern}`).limit(5);
    if(opportunities.error&&opportunities.error.code!=="42P01")partialErrors.push(opportunities.error.message);
    for(const deal of opportunities.data??[])results.push({id:`opportunity-${deal.id}`,kind:"Opportunité",title:deal.name,subtitle:`${deal.stage} · ${Number(deal.amount||0).toLocaleString("fr-FR")} ${deal.currency||""}${deal.owner?` · ${deal.owner}`:""}`,href:`/admin/opportunites?opportunity=${deal.id}`});

    const proposals=await supabase.from("website_crm_proposals").select("id,reference,title,status,total_amount,currency,opportunity_id").or(`reference.ilike.${pattern},title.ilike.${pattern}`).limit(5);
    if(proposals.error&&proposals.error.code!=="42P01")partialErrors.push(proposals.error.message);
    for(const proposal of proposals.data??[])results.push({id:`proposal-${proposal.id}`,kind:"Proposition",title:proposal.reference,subtitle:`${proposal.title} · ${proposal.status} · ${Number(proposal.total_amount||0).toLocaleString("fr-FR")} ${proposal.currency||""}`,href:`/admin/opportunites?opportunity=${proposal.opportunity_id}`});
  }

  if(hasAdminPermission(session,"site.read")){
    const response=await supabase.from("website_pages").select("id,title,slug,status").or(`title.ilike.${pattern},slug.ilike.${pattern}`).limit(5);
    if(response.error)partialErrors.push(response.error.message);
    for(const page of response.data??[])results.push({id:`page-${page.id}`,kind:"Page",title:page.title,subtitle:`${page.slug} · ${page.status}`,href:`/admin/pages?page=${page.id}`});
  }

  if(hasAdminPermission(session,"content.read")){
    const response=await supabase.from("website_articles").select("id,title,slug,category,status").or(`title.ilike.${pattern},category.ilike.${pattern}`).limit(5);
    if(response.error)partialErrors.push(response.error.message);
    for(const article of response.data??[])results.push({id:`article-${article.id}`,kind:"Article",title:article.title,subtitle:`${article.category} · ${article.status}`,href:`/admin/articles?article=${article.id}`});
  }

  if(hasAdminPermission(session,"support.read")){
    const response=await supabase.from("support_tickets").select("id,requester_name,requester_email,subject,status").or(`requester_name.ilike.${pattern},requester_email.ilike.${pattern},subject.ilike.${pattern}`).limit(5);
    if(response.error)partialErrors.push(response.error.message);
    for(const ticket of response.data??[])results.push({id:`ticket-${ticket.id}`,kind:"Support",title:ticket.subject,subtitle:`${ticket.requester_name||ticket.requester_email} · ${ticket.status}`,href:`/admin/service-client?ticket=${ticket.id}`});
  }

  return NextResponse.json({results,partialErrors});
}
