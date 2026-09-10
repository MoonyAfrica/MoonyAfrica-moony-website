import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { hasAdminPermission } from "@/lib/admin-auth";

function countByStatus(rows: any[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = typeof row.status === "string" ? row.status : "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export async function GET(request: Request) {
  const { error, supabase, session } = requireAdmin(request);
  if (error || !supabase || !session) return error;

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const nowIso = new Date().toISOString();

  let eventRows: Array<{ event_name: string; country: string | null; created_at: string }> = [];
  let leadRows: any[] = [];
  let appointmentRows: any[] = [];
  let ticketRows: any[] = [];
  let campaignRows: any[] = [];
  let marketingRows: any[] = [];
  let partnerRows: any[] = [];
  let testimonialRows: any[] = [];
  let taskRows: any[] = [];
  let pageRows: any[] = [];
  let articleRows: any[] = [];
  let resourceRows: any[] = [];
  let teamRows: any[] = [];
  let activeSessionCount = 0;
  let tasksAvailable = false;
  let teamSecurityAvailable = false;

  if (hasAdminPermission(session, "analytics.read")) {
    const result = await supabase.from("website_analytics_events").select("event_name,country,created_at").gte("created_at", since).order("created_at", { ascending: true }).limit(12000);
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    eventRows = (result.data ?? []) as typeof eventRows;
  }

  if (hasAdminPermission(session, "crm.read")) {
    const [leads, tasks] = await Promise.all([
      supabase.from("website_leads").select("id,created_at,first_name,last_name,email,company,status,deal_value,country,need,assigned_to,updated_at").order("updated_at", { ascending: false }).limit(200),
      supabase.from("website_crm_tasks").select("id,lead_id,title,due_at,status,priority,assigned_to,website_leads(first_name,last_name,company)").in("status", ["todo", "in_progress"]).order("due_at", { ascending: true, nullsFirst: false }).limit(30),
    ]);
    if (leads.error) return NextResponse.json({ error: leads.error.message }, { status: 500 });
    leadRows = leads.data ?? [];
    taskRows = tasks.error ? [] : (tasks.data ?? []);
    tasksAvailable = !tasks.error;
  }

  if (hasAdminPermission(session, "appointments.read")) {
    const result = await supabase.from("website_appointments").select("id,created_at,starts_at,status,provider,meeting_url,notes,lead_id").order("starts_at", { ascending: true }).limit(100);
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    appointmentRows = result.data ?? [];
  }

  if (hasAdminPermission(session, "support.read")) {
    const result = await supabase.from("support_tickets").select("id,created_at,requester_name,requester_email,type,subject,priority,status").order("created_at", { ascending: false }).limit(100);
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    ticketRows = result.data ?? [];
  }

  if (hasAdminPermission(session, "marketing.read")) {
    const [campaigns, elements] = await Promise.all([
      supabase.from("newsletter_campaigns").select("id,name,subject,status,scheduled_at,sent_at,stats,created_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("marketing_elements").select("id,name,kind,status,start_at,end_at,updated_at").order("updated_at", { ascending: false }).limit(50),
    ]);
    if (campaigns.error) return NextResponse.json({ error: campaigns.error.message }, { status: 500 });
    campaignRows = campaigns.data ?? [];
    marketingRows = elements.error ? [] : (elements.data ?? []);
  }

  if (hasAdminPermission(session, "site.read")) {
    const result = await supabase.from("website_pages").select("id,title,slug,status,updated_at").order("updated_at", { ascending: false }).limit(50);
    pageRows = result.error ? [] : (result.data ?? []);
  }

  if (hasAdminPermission(session, "content.read")) {
    const [articles, resources, partners, testimonials] = await Promise.all([
      supabase.from("website_articles").select("id,title,slug,status,category,updated_at,scheduled_at,published_at").order("updated_at", { ascending: false }).limit(50),
      supabase.from("website_resources").select("id,title,slug,status,resource_type,updated_at").order("updated_at", { ascending: false }).limit(50),
      supabase.from("website_partners").select("id,name,status,featured,created_at").order("created_at", { ascending: false }).limit(20),
      supabase.from("website_testimonials").select("id,author_name,status,featured,created_at").order("created_at", { ascending: false }).limit(20),
    ]);
    articleRows = articles.error ? [] : (articles.data ?? []);
    resourceRows = resources.error ? [] : (resources.data ?? []);
    partnerRows = partners.error ? [] : (partners.data ?? []);
    testimonialRows = testimonials.error ? [] : (testimonials.data ?? []);
  }

  if (hasAdminPermission(session, "team.manage")) {
    const team = await supabase.from("control_center_users").select("id,full_name,email,active,last_login_at,metadata,must_change_password").order("created_at", { ascending: true }).limit(100);
    if (!team.error) {
      teamRows = team.data ?? [];
      teamSecurityAvailable = true;
    } else {
      const fallback = await supabase.from("control_center_users").select("id,full_name,email,active,last_login_at,metadata").order("created_at", { ascending: true }).limit(100);
      teamRows = fallback.error ? [] : (fallback.data ?? []);
      teamSecurityAvailable = !fallback.error;
    }

    const sessions = await supabase.from("control_center_sessions").select("id", { count: "exact", head: true }).is("revoked_at", null).gt("expires_at", nowIso);
    activeSessionCount = sessions.error ? 0 : (sessions.count ?? 0);
  }

  const pageViews = eventRows.filter((item) => item.event_name === "page_view");
  const appClicks = eventRows.filter((item) => item.event_name === "app_click");
  const countries = Object.entries(pageViews.map((item) => item.country).filter(Boolean).reduce<Record<string, number>>((acc, value) => {
    const key = value as string;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));

  const dailyMap = pageViews.reduce<Record<string, number>>((acc, item) => {
    const day = item.created_at.slice(0, 10);
    acc[day] = (acc[day] ?? 0) + 1;
    return acc;
  }, {});
  const daily = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.now() - (29 - index) * 86400000).toISOString().slice(0, 10);
    return { date, views: dailyMap[date] ?? 0 };
  });

  const now = Date.now();
  const upcoming = appointmentRows.filter((item) => item.starts_at && new Date(item.starts_at).getTime() >= now && item.status !== "cancelled").slice(0, 12);
  const conversionCount = leadRows.filter((item) => new Date(item.created_at).getTime() >= now - 30 * 86400000).length;
  const conversionBase = pageViews.length;
  const leadStatuses = countByStatus(leadRows);
  const ticketStatuses = countByStatus(ticketRows);
  const campaignStatuses = countByStatus(campaignRows);
  const marketingStatuses = countByStatus(marketingRows);
  const pageStatuses = countByStatus(pageRows);
  const articleStatuses = countByStatus(articleRows);
  const resourceStatuses = countByStatus(resourceRows);

  const activeTeam = teamRows.filter((member) => member.active);
  const teamWithoutMfa = activeTeam.filter((member) => !(member.metadata && typeof member.metadata === "object" && member.metadata.mfa_required === true)).length;
  const mustChangePassword = activeTeam.filter((member) => member.must_change_password === true).length;

  return NextResponse.json({
    viewer: {
      name: session.name,
      email: session.email,
      role: session.role,
      permissions: session.permissions,
      legacy: Boolean(session.legacy),
      mfa: Boolean(session.mfa),
    },
    permissions: session.permissions,
    metrics: {
      pageViews: pageViews.length,
      appClicks: appClicks.length,
      leads30d: conversionCount,
      appointments30d: appointmentRows.filter((item) => new Date(item.created_at).getTime() >= now - 30 * 86400000).length,
      conversionRate: conversionBase ? Number(((conversionCount / conversionBase) * 100).toFixed(1)) : 0,
    },
    daily,
    countries,
    leads: leadRows,
    leadSummary: {
      total: leadRows.length,
      new: (leadStatuses.new ?? 0) + (leadStatuses.to_contact ?? 0),
      negotiation: (leadStatuses.proposal ?? 0) + (leadStatuses.negotiation ?? 0),
      won: leadStatuses.won ?? 0,
    },
    upcomingAppointments: upcoming,
    tasks: taskRows,
    tasksAvailable,
    tickets: ticketRows,
    supportSummary: {
      total: ticketRows.length,
      open: ticketRows.filter((item) => !["closed", "resolved"].includes(item.status)).length,
      urgent: ticketRows.filter((item) => item.priority === "urgent" && !["closed", "resolved"].includes(item.status)).length,
      byStatus: ticketStatuses,
    },
    campaigns: campaignRows,
    marketingElements: marketingRows,
    marketingSummary: {
      campaignsDraft: campaignStatuses.draft ?? 0,
      campaignsScheduled: campaignStatuses.scheduled ?? 0,
      activeElements: marketingStatuses.active ?? 0,
      scheduledElements: marketingStatuses.scheduled ?? 0,
    },
    pages: pageRows,
    articles: articleRows,
    resources: resourceRows,
    contentSummary: {
      pagesDraft: pageStatuses.draft ?? 0,
      pagesPublished: pageStatuses.published ?? 0,
      articlesDraft: (articleStatuses.draft ?? 0) + (articleStatuses.review ?? 0),
      articlesPublished: articleStatuses.published ?? 0,
      resourcesDraft: resourceStatuses.draft ?? 0,
      resourcesPublished: resourceStatuses.published ?? 0,
    },
    partners: partnerRows,
    testimonials: testimonialRows,
    teamSummary: {
      available: teamSecurityAvailable,
      total: teamRows.length,
      active: activeTeam.length,
      withoutMfa: teamWithoutMfa,
      mustChangePassword,
      activeSessions: activeSessionCount,
    },
  });
}
