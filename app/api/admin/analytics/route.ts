import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request); if (error || !supabase) return error;
  const url = new URL(request.url); const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [eventsResult, leadsResult, subsResult] = await Promise.all([
    supabase.from("website_analytics_events").select("event_name,path,country,city,device,source,created_at").gte("created_at", since).order("created_at", { ascending: true }).limit(15000),
    supabase.from("website_leads").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).gte("created_at", since).eq("status", "subscribed"),
  ]);
  if (eventsResult.error) return NextResponse.json({ error: eventsResult.error.message }, { status: 500 });
  const events = eventsResult.data ?? [];
  const pageViews = events.filter((x) => x.event_name === "page_view");
  const appClicks = events.filter((x) => x.event_name === "app_click");
  const ctaClicks = events.filter((x) => x.event_name === "cta_click");
  const counter = (values: (string | null)[]) => Object.entries(values.filter(Boolean).reduce<Record<string, number>>((acc, value) => { const key = value as string; acc[key] = (acc[key] || 0) + 1; return acc; }, {})).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,value])=>({name,value}));
  const dailyMap = pageViews.reduce<Record<string, number>>((acc, item) => { const day = item.created_at.slice(0,10); acc[day] = (acc[day] || 0) + 1; return acc; }, {});
  const daily = Array.from({ length: days }, (_, index) => { const date = new Date(Date.now() - (days - 1 - index) * 86400000).toISOString().slice(0,10); return { date, views: dailyMap[date] || 0 }; });
  const conversions = (leadsResult.count || 0) + (subsResult.count || 0);
  return NextResponse.json({
    rangeDays: days,
    metrics: { pageViews: pageViews.length, appClicks: appClicks.length, ctaClicks: ctaClicks.length, leads: leadsResult.count || 0, newsletterSignups: subsResult.count || 0, conversionRate: pageViews.length ? Number(((conversions / pageViews.length) * 100).toFixed(1)) : 0 },
    daily,
    topPages: counter(pageViews.map((x) => x.path)),
    countries: counter(pageViews.map((x) => x.country)),
    cities: counter(pageViews.map((x) => x.city)),
    devices: counter(pageViews.map((x) => x.device)),
    sources: counter(pageViews.map((x) => x.source)),
  });
}
