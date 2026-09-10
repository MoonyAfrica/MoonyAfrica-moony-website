import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

type SearchResult={id:string;kind:string;title:string;subtitle:string;href:string};

export async function GET(request:Request){
  const {error,supabase}=requireAdmin(request);if(error||!supabase)return error;
  const q=(new URL(request.url).searchParams.get("q")||"").trim().slice(0,120);
  if(q.length<2)return NextResponse.json({results:[]});
  const pattern=`%${q.replace(/[%_]/g,"\\$&")}%`;

  const [leadsRes,pagesRes,articlesRes,ticketsRes]=await Promise.all([
    supabase.from("website_leads").select("id,first_name,last_name,email,company,status").or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},company.ilike.${pattern}`).limit(5),
    supabase.from("website_pages").select("id,title,slug,status").or(`title.ilike.${pattern},slug.ilike.${pattern}`).limit(5),
    supabase.from("website_articles").select("id,title,slug,category,status").or(`title.ilike.${pattern},category.ilike.${pattern}`).limit(5),
    supabase.from("support_tickets").select("id,requester_name,requester_email,subject,status").or(`requester_name.ilike.${pattern},requester_email.ilike.${pattern},subject.ilike.${pattern}`).limit(5),
  ]);

  const results:SearchResult[]=[];
  for(const lead of leadsRes.data??[])results.push({id:`lead-${lead.id}`,kind:"CRM",title:lead.company||`${lead.first_name} ${lead.last_name}`,subtitle:`${lead.first_name} ${lead.last_name} · ${lead.email} · ${lead.status}`,href:`/admin/crm?lead=${lead.id}`});
  for(const page of pagesRes.data??[])results.push({id:`page-${page.id}`,kind:"Page",title:page.title,subtitle:`${page.slug} · ${page.status}`,href:`/admin/pages?page=${page.id}`});
  for(const article of articlesRes.data??[])results.push({id:`article-${article.id}`,kind:"Article",title:article.title,subtitle:`${article.category} · ${article.status}`,href:`/admin/articles?article=${article.id}`});
  for(const ticket of ticketsRes.data??[])results.push({id:`ticket-${ticket.id}`,kind:"Support",title:ticket.subject,subtitle:`${ticket.requester_name||ticket.requester_email} · ${ticket.status}`,href:`/admin/service-client?ticket=${ticket.id}`});
  return NextResponse.json({results,partialErrors:[leadsRes.error,pagesRes.error,articlesRes.error,ticketsRes.error].filter(Boolean).map(item=>item?.message)});
}
