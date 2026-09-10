import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { hasAdminPermission } from "@/lib/admin-auth";

type NotificationItem = {
  id: string;
  kind: "task" | "ticket" | "appointment";
  title: string;
  subtitle: string;
  href: string;
  severity: "info" | "warning" | "urgent";
  dueAt?: string | null;
};

function leadOf(value: unknown) {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined;
  return value as Record<string, unknown> | null;
}

export async function GET(request: Request) {
  const { error, supabase, session } = requireAdmin(request);
  if (error || !supabase) return error;

  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const items: NotificationItem[] = [];
  let tasksAvailable = false;

  if (hasAdminPermission(session, "crm.read")) {
    const tasks = await supabase.from("website_crm_tasks").select("id,lead_id,title,due_at,status,priority,assigned_to,website_leads(first_name,last_name,company)").in("status", ["todo", "in_progress"]).lte("due_at", now.toISOString()).order("due_at", { ascending: true }).limit(12);
    tasksAvailable = !tasks.error;
    if (!tasks.error) {
      for (const task of tasks.data ?? []) {
        const lead = leadOf(task.website_leads);
        const company = typeof lead?.company === "string" && lead.company ? lead.company : null;
        const person = lead ? `${String(lead.first_name ?? "")} ${String(lead.last_name ?? "")}`.trim() : "Prospect";
        items.push({ id:`task-${task.id}`, kind:"task", title:task.title, subtitle:`${company || person} · relance en retard`, href:`/admin/crm?lead=${task.lead_id}`, severity:task.priority === "urgent" ? "urgent" : "warning", dueAt:task.due_at });
      }
    }
  }

  if (hasAdminPermission(session, "support.read")) {
    const tickets = await supabase.from("support_tickets").select("id,subject,requester_name,requester_email,priority,status,updated_at").in("status", ["open", "in_progress"]).in("priority", ["high", "urgent"]).order("updated_at", { ascending: false }).limit(8);
    if (!tickets.error) for (const ticket of tickets.data ?? []) items.push({ id:`ticket-${ticket.id}`, kind:"ticket", title:ticket.subject, subtitle:`${ticket.requester_name || ticket.requester_email} · ${ticket.priority === "urgent" ? "urgent" : "priorité haute"}`, href:`/admin/service-client?ticket=${ticket.id}`, severity:ticket.priority === "urgent" ? "urgent" : "warning" });
  }

  if (hasAdminPermission(session, "appointments.read")) {
    const appointments = await supabase.from("website_appointments").select("id,lead_id,starts_at,status,provider,website_leads(first_name,last_name,company)").in("status", ["pending", "confirmed"]).gte("starts_at", now.toISOString()).lte("starts_at", next24h).order("starts_at", { ascending: true }).limit(8);
    if (!appointments.error) for (const appointment of appointments.data ?? []) {
      const lead = leadOf(appointment.website_leads);
      const company = typeof lead?.company === "string" && lead.company ? lead.company : null;
      const person = lead ? `${String(lead.first_name ?? "")} ${String(lead.last_name ?? "")}`.trim() : "Prospect";
      items.push({ id:`appointment-${appointment.id}`, kind:"appointment", title:`Rendez-vous ${appointment.status === "confirmed" ? "confirmé" : "à confirmer"}`, subtitle:`${company || person} · dans les prochaines 24 h`, href:"/admin/rendez-vous", severity:"info", dueAt:appointment.starts_at });
    }
  }

  items.sort((a, b) => {
    const order = { urgent: 0, warning: 1, info: 2 };
    const severity = order[a.severity] - order[b.severity];
    if (severity) return severity;
    return new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime();
  });

  return NextResponse.json({ items: items.slice(0, 20), count: items.length, tasksAvailable });
}
