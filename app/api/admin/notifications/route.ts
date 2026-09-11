import { NextResponse } from "next/server";
import { asText, requireAdmin } from "@/lib/admin-api";
import { hasAdminPermission } from "@/lib/admin-auth";

type NotificationKind = "task" | "lead" | "ticket" | "appointment" | "campaign" | "content" | "proposal" | "onboarding" | "client";
type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  subtitle: string;
  href: string;
  severity: "info" | "warning" | "urgent";
  dueAt?: string | null;
  createdAt?: string | null;
  read?: boolean;
};

type ReadState = { notification_key: string; read_at: string | null; dismissed_at: string | null };

function leadOf(value: unknown) {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined;
  return value as Record<string, unknown> | null;
}

function sortItems(items: NotificationItem[]) {
  const order = { urgent: 0, warning: 1, info: 2 };
  return items.sort((a, b) => {
    const severity = order[a.severity] - order[b.severity];
    if (severity) return severity;
    const aDate = new Date(a.dueAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.dueAt || b.createdAt || 0).getTime();
    return aDate - bDate;
  });
}

async function parseBody(request: Request) {
  try { return (await request.json()) as Record<string, unknown>; } catch { return null; }
}

export async function GET(request: Request) {
  const { error, supabase, session } = requireAdmin(request);
  if (error || !supabase || !session) return error;

  const now = new Date();
  const nowIso = now.toISOString();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const items: NotificationItem[] = [];
  let tasksAvailable = false;

  if (hasAdminPermission(session, "crm.read")) {
    const [tasks, leads] = await Promise.all([
      supabase.from("website_crm_tasks").select("id,lead_id,title,due_at,status,priority,assigned_to,website_leads(first_name,last_name,company)").in("status", ["todo", "in_progress"]).lte("due_at", nowIso).order("due_at", { ascending: true }).limit(12),
      supabase.from("website_leads").select("id,first_name,last_name,company,country,created_at,status").gte("created_at", last24h).in("status", ["new", "to_contact"]).order("created_at", { ascending: false }).limit(10),
    ]);
    tasksAvailable = !tasks.error;
    if (!tasks.error) {
      for (const task of tasks.data ?? []) {
        const lead = leadOf(task.website_leads);
        const company = typeof lead?.company === "string" && lead.company ? lead.company : null;
        const person = lead ? `${String(lead.first_name ?? "")} ${String(lead.last_name ?? "")}`.trim() : "Prospect";
        items.push({ id:`task-${task.id}`, kind:"task", title:task.title, subtitle:`${company || person} · relance en retard`, href:`/admin/crm?lead=${task.lead_id}`, severity:task.priority === "urgent" ? "urgent" : "warning", dueAt:task.due_at });
      }
    }
    if (!leads.error) {
      for (const lead of leads.data ?? []) {
        const label = lead.company || `${lead.first_name} ${lead.last_name}`.trim();
        items.push({ id:`lead-${lead.id}`, kind:"lead", title:"Nouveau prospect", subtitle:`${label}${lead.country ? ` · ${lead.country}` : ""}`, href:`/admin/crm?lead=${lead.id}`, severity:"info", createdAt:lead.created_at });
      }
    }
  }

  if (hasAdminPermission(session, "support.read")) {
    const tickets = await supabase.from("support_tickets").select("id,subject,requester_name,requester_email,priority,status,created_at,updated_at").in("status", ["open", "in_progress"]).in("priority", ["high", "urgent"]).order("updated_at", { ascending: false }).limit(10);
    if (!tickets.error) {
      for (const ticket of tickets.data ?? []) {
        items.push({ id:`ticket-${ticket.id}`, kind:"ticket", title:ticket.subject, subtitle:`${ticket.requester_name || ticket.requester_email} · ${ticket.priority === "urgent" ? "urgent" : "priorité haute"}`, href:`/admin/service-client?ticket=${ticket.id}`, severity:ticket.priority === "urgent" ? "urgent" : "warning", createdAt:ticket.created_at });
      }
    }
  }

  if (hasAdminPermission(session, "appointments.read")) {
    const appointments = await supabase.from("website_appointments").select("id,lead_id,starts_at,status,provider,website_leads(first_name,last_name,company)").in("status", ["pending", "confirmed"]).gte("starts_at", nowIso).lte("starts_at", next24h).order("starts_at", { ascending: true }).limit(10);
    if (!appointments.error) {
      for (const appointment of appointments.data ?? []) {
        const lead = leadOf(appointment.website_leads);
        const company = typeof lead?.company === "string" && lead.company ? lead.company : null;
        const person = lead ? `${String(lead.first_name ?? "")} ${String(lead.last_name ?? "")}`.trim() : "Prospect";
        items.push({ id:`appointment-${appointment.id}`, kind:"appointment", title:`Rendez-vous ${appointment.status === "confirmed" ? "confirmé" : "à confirmer"}`, subtitle:`${company || person} · dans les prochaines 24 h`, href:"/admin/rendez-vous", severity:"info", dueAt:appointment.starts_at });
      }
    }
  }

  if (hasAdminPermission(session, "marketing.read")) {
    const campaigns = await supabase.from("newsletter_campaigns").select("id,name,subject,status,scheduled_at").eq("status", "scheduled").gte("scheduled_at", nowIso).lte("scheduled_at", next24h).order("scheduled_at", { ascending: true }).limit(8);
    if (!campaigns.error) {
      for (const campaign of campaigns.data ?? []) {
        items.push({ id:`campaign-${campaign.id}`, kind:"campaign", title:`Campagne « ${campaign.name} »`, subtitle:"Envoi programmé dans les prochaines 24 h", href:"/admin/newsletters", severity:"info", dueAt:campaign.scheduled_at });
      }
    }
  }

  if (hasAdminPermission(session, "content.read")) {
    const articles = await supabase.from("website_articles").select("id,title,status,scheduled_at").eq("status", "scheduled").gte("scheduled_at", nowIso).lte("scheduled_at", next24h).order("scheduled_at", { ascending: true }).limit(8);
    if (!articles.error) {
      for (const article of articles.data ?? []) {
        items.push({ id:`article-${article.id}`, kind:"content", title:`Publication « ${article.title} »`, subtitle:"Article programmé dans les prochaines 24 h", href:"/admin/articles", severity:"info", dueAt:article.scheduled_at });
      }
    }
  }

  const generated = await supabase.from("control_center_generated_notifications").select("id,target_role,target_user_key,title,subtitle,href,severity,source_type,source_id,created_at,expires_at").order("created_at", { ascending: false }).limit(100);
  if (!generated.error) {
    const crmSources = ["crm_proposal","crm_onboarding","crm_customer_success","crm_retention","crm_success_plan","crm_account_governance","crm_executive_portfolio","crm_escalation","crm_revenue_forecast","crm_billing"];
    for (const item of generated.data ?? []) {
      if (item.expires_at && new Date(item.expires_at).getTime() <= now.getTime()) continue;
      const targeted = (!item.target_role && !item.target_user_key) || item.target_role === session.role || item.target_user_key === session.sub;
      if (!targeted) continue;
      if(crmSources.includes(item.source_type) && !hasAdminPermission(session,"crm.read")) continue;
      const kind: NotificationKind = item.source_type === "support_ticket" ? "ticket" : item.source_type === "appointment" ? "appointment" : item.source_type === "lead" ? "lead" : item.source_type === "crm_proposal" ? "proposal" : item.source_type === "crm_onboarding" ? "onboarding" : crmSources.includes(item.source_type) ? "client" : "content";
      items.push({ id:`auto-${item.id}`, kind, title:item.title, subtitle:item.subtitle || "Automatisation MOONY", href:item.href || "/admin/activite", severity:item.severity === "urgent" ? "urgent" : item.severity === "warning" ? "warning" : "info", createdAt:item.created_at });
    }
  }

  let stateAvailable = true;
  const states = new Map<string, ReadState>();
  if (items.length) {
    const result = await supabase.from("control_center_notification_reads").select("notification_key,read_at,dismissed_at").eq("user_key", session.sub).in("notification_key", items.map((item) => item.id));
    if (result.error) stateAvailable = false;
    else for (const row of (result.data ?? []) as ReadState[]) states.set(row.notification_key, row);
  }

  const visible = sortItems(items.filter((item) => !states.get(item.id)?.dismissed_at).map((item) => ({ ...item, read:Boolean(states.get(item.id)?.read_at) })));
  const unreadCount = visible.filter((item) => !item.read).length;

  return NextResponse.json({ items: visible.slice(0, 30), count: visible.length, unreadCount, tasksAvailable, stateAvailable, automationNotificationsAvailable: !generated.error });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request);
  if (error || !supabase || !session) return error;
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const action = asText(body.action, 30);
  const ids = Array.isArray(body.ids) ? body.ids.map((value) => asText(value, 160)).filter(Boolean).slice(0, 100) : [asText(body.id, 160)].filter(Boolean);
  if (!ids.length || !["read", "unread", "dismiss"].includes(action)) return NextResponse.json({ error: "Action ou notification invalide." }, { status: 422 });

  const now = new Date().toISOString();
  const rows = ids.map((id) => ({
    user_key: session.sub,
    notification_key: id,
    read_at: action === "unread" ? null : now,
    dismissed_at: action === "dismiss" ? now : null,
    updated_at: now,
  }));
  const { error: stateError } = await supabase.from("control_center_notification_reads").upsert(rows, { onConflict: "user_key,notification_key" });
  if (stateError) return NextResponse.json({ error: "Appliquez la migration des notifications pour activer l’état lu/non lu.", detail: stateError.message }, { status: 503 });
  return NextResponse.json({ ok: true });
}
