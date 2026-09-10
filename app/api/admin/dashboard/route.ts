import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request); if (error || !supabase) return error;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [events, leads, appointments, tickets, campaigns, partners, testimonials, tasks] = await Promise.all([
    supabase.from("website_analytics_events").select("event_name,country,created_at").gte("created_at", since).order("created_at",{ascending:true}).limit(12000),
    supabase.from("website_leads").select("id,created_at,first_name,last_name,email,company,status,deal_value,country,need,assigned_to,updated_at").order("updated_at",{ascending:false}).limit(100),
    supabase.from("website_appointments").select("id,created_at,starts_at,status,provider,meeting_url,notes,lead_id").order("starts_at",{ascending:true}).limit(50),
    supabase.from("support_tickets").select("id,created_at,requester_name,requester_email,type,subject,priority,status").order("created_at",{ascending:false}).limit(8),
    supabase.from("newsletter_campaigns").select("id,name,subject,status,scheduled_at,sent_at,stats,created_at").order("created_at",{ascending:false}).limit(5),
    supabase.from("website_partners").select("id,name,status,featured,created_at").order("created_at",{ascending:false}).limit(8),
    supabase.from("website_testimonials").select("id,author_name,status,featured,created_at").order("created_at",{ascending:false}).limit(8),
    supabase.from("website_crm_tasks").select("id,lead_id,title,due_at,status,priority,assigned_to,website_leads(first_name,last_name,company)").in("status",["todo","in_progress"]).order("due_at",{ascending:true,nullsFirst:false}).limit(10),
  ]);
  const firstError=[events.error,leads.error,appointments.error,tickets.error,campaigns.error,partners.error,testimonials.error].find(Boolean);
  if(firstError)return NextResponse.json({error:firstError.message},{status:500});
  const allEvents=events.data??[]; const pageViews=allEvents.filter(x=>x.event_name==="page_view"); const appClicks=allEvents.filter(x=>x.event_name==="app_click");
  const leadRows=leads.data??[]; const appointmentRows=appointments.data??[];
  const countries=Object.entries(pageViews.map(x=>x.country).filter(Boolean).reduce<Record<string,number>>((acc,value)=>{const key=value as string;acc[key]=(acc[key]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value])=>({name,value}));
  const dailyMap=pageViews.reduce<Record<string,number>>((acc,item)=>{const day=item.created_at.slice(0,10);acc[day]=(acc[day]||0)+1;return acc;},{});
  const daily=Array.from({length:30},(_,index)=>{const date=new Date(Date.now()-(29-index)*86400000).toISOString().slice(0,10);return{date,views:dailyMap[date]||0}});
  const now=Date.now(); const upcoming=appointmentRows.filter(x=>x.starts_at&&new Date(x.starts_at).getTime()>=now&&x.status!=="cancelled").slice(0,6);
  const conversionBase=pageViews.length||0; const conversionCount=leadRows.filter(x=>new Date(x.created_at).getTime()>=Date.now()-30*86400000).length;
  return NextResponse.json({
    metrics:{pageViews:pageViews.length,appClicks:appClicks.length,leads30d:conversionCount,appointments30d:appointmentRows.filter(x=>new Date(x.created_at).getTime()>=Date.now()-30*86400000).length,conversionRate:conversionBase?Number(((conversionCount/conversionBase)*100).toFixed(1)):0},
    daily,countries,
    leads:leadRows,
    upcomingAppointments:upcoming,
    tasks:tasks.error?[]:(tasks.data??[]),
    tasksAvailable:!tasks.error,
    tickets:tickets.data??[],campaigns:campaigns.data??[],partners:partners.data??[],testimonials:testimonials.data??[],
  });
}
