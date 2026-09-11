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
    for(const proposal of proposals.data??[])results.push({id:`proposal-${proposal.id}`,kind:"Proposition",title:proposal.reference,subtitle:`${proposal.title} · ${proposal.status} · ${Number(proposal.total_amount||0).toLocaleString("fr-FR")} ${proposal.currency||""}`,href:`/admin/propositions/${proposal.id}`});

    const onboarding=await supabase.from("website_crm_onboarding_cases").select("id,status,owner,commercial_owner,website_leads(first_name,last_name,email,company),website_crm_opportunities(name)").or(`owner.ilike.${pattern},commercial_owner.ilike.${pattern}`).limit(5);
    if(onboarding.error&&onboarding.error.code!=="42P01")partialErrors.push(onboarding.error.message);
    for(const item of onboarding.data??[]){const lead=Array.isArray(item.website_leads)?item.website_leads[0]:item.website_leads;const opportunity=Array.isArray(item.website_crm_opportunities)?item.website_crm_opportunities[0]:item.website_crm_opportunities;const title=lead?.company||`${lead?.first_name||""} ${lead?.last_name||""}`.trim()||opportunity?.name||"Dossier client";const hay=`${title} ${lead?.email||""} ${opportunity?.name||""}`.toLowerCase();if(hay.includes(q.toLowerCase()))results.push({id:`onboarding-${item.id}`,kind:"Onboarding",title,subtitle:`${item.status}${item.owner?` · ${item.owner}`:""}`,href:`/admin/onboarding?case=${item.id}`})}

    const contracts=await supabase.from("website_crm_contracts").select("id,onboarding_id,reference,title,status,version").or(`reference.ilike.${pattern},title.ilike.${pattern}`).limit(5);
    if(contracts.error&&contracts.error.code!=="42P01")partialErrors.push(contracts.error.message);
    for(const contract of contracts.data??[])results.push({id:`contract-${contract.id}`,kind:"Contrat",title:contract.reference,subtitle:`${contract.title} · V${contract.version} · ${contract.status}`,href:`/admin/onboarding?case=${contract.onboarding_id}`});

    const clients=await supabase.from("website_crm_client_accounts").select("id,account_name,status,owner,commercial_owner,website_leads(email,country)").or(`account_name.ilike.${pattern},owner.ilike.${pattern},commercial_owner.ilike.${pattern}`).limit(5);
    if(clients.error&&clients.error.code!=="42P01")partialErrors.push(clients.error.message);
    for(const client of clients.data??[]){const lead=Array.isArray(client.website_leads)?client.website_leads[0]:client.website_leads;results.push({id:`client-${client.id}`,kind:"Client actif",title:client.account_name,subtitle:`${client.status}${lead?.country?` · ${lead.country}`:""}${client.owner?` · ${client.owner}`:""}`,href:`/admin/clients?client=${client.id}`})}
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