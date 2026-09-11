import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { triggerAutomationEvent } from "@/lib/automation-engine";

const statuses = new Set(["open", "in_progress", "waiting", "resolved", "closed"]);
const priorities = new Set(["low", "normal", "high", "urgent"]);
const types = new Set(["question", "request", "incident", "complaint", "feedback"]);

async function parseBody(request: Request) {
  try { return (await request.json()) as Record<string, unknown>; } catch { return null; }
}

async function runUrgentAutomation(supabase: NonNullable<ReturnType<typeof requireAdmin>["supabase"]>, ticket: Record<string, unknown>) {
  try {
    await triggerAutomationEvent(supabase, "urgent_ticket", "support_ticket", String(ticket.id), {
      ticket_id: String(ticket.id),
      subject: ticket.subject,
      requester: ticket.requester_name || ticket.requester_email,
      requester_email: ticket.requester_email,
      email: ticket.requester_email,
      priority: ticket.priority,
      status: ticket.status,
      type: ticket.type,
      assigned_to: ticket.assigned_to,
    });
  } catch {
    // The ticket action must remain successful if a non-critical automation fails.
  }
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request, "support.read");
  if (error || !supabase) return error;

  const { data: tickets, error: ticketError } = await supabase.from("support_tickets").select("*").order("updated_at", { ascending: false }).limit(200);
  if (ticketError) return NextResponse.json({ error: ticketError.message }, { status: 500 });

  const ids = (tickets ?? []).map((ticket) => ticket.id);
  let messages: unknown[] = [];
  if (ids.length) {
    const { data, error: messageError } = await supabase.from("support_ticket_messages").select("*").in("ticket_id", ids).order("created_at", { ascending: true });
    if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 });
    messages = data ?? [];
  }

  return NextResponse.json({ tickets: tickets ?? [], messages });
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "support.write");
  if (error || !supabase) return error;
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const email = asText(body.email, 240).toLowerCase();
  const subject = asText(body.subject, 240);
  const message = asText(body.message, 5000);
  if (!email || !email.includes("@") || !subject || !message) return NextResponse.json({ error: "E-mail, sujet et message obligatoires." }, { status: 422 });

  const type = types.has(asText(body.type, 40)) ? asText(body.type, 40) : "request";
  const priority = priorities.has(asText(body.priority, 40)) ? asText(body.priority, 40) : "normal";
  const assignedTo = asNullableText(body.assignedTo, 180) || session?.name || null;
  const { data, error: insertError } = await supabase.from("support_tickets").insert({
    requester_name: asNullableText(body.name, 180), requester_email: email, type, subject, message, priority, status: "open", assigned_to: assignedTo, metadata: { source: "control-center" },
  }).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  await supabase.from("support_ticket_messages").insert({ ticket_id: data.id, sender_kind: "agent", sender_name: assignedTo || "Équipe MOONY", body: message });
  await writeAuditLog(supabase, session, "support.ticket_created", "support_ticket", data.id, `Ticket « ${subject} » créé`, { priority, type, requesterEmail: email });
  if (data.priority === "urgent") await runUrgentAutomation(supabase, data as Record<string, unknown>);
  return NextResponse.json({ ticket: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "support.write");
  if (error || !supabase) return error;
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const id = asText(body.id, 80);
  if (!id) return NextResponse.json({ error: "Ticket manquant." }, { status: 422 });

  const { data: before } = await supabase.from("support_tickets").select("subject,status,priority,assigned_to").eq("id", id).maybeSingle();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.status === "string" && statuses.has(body.status)) patch.status = body.status;
  if (typeof body.priority === "string" && priorities.has(body.priority)) patch.priority = body.priority;
  if ("assignedTo" in body) patch.assigned_to = asNullableText(body.assignedTo, 180);
  if (typeof body.subject === "string") patch.subject = asText(body.subject, 240);
  if (typeof body.type === "string" && types.has(body.type)) patch.type = body.type;

  const { data, error: updateError } = await supabase.from("support_tickets").update(patch).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await writeAuditLog(supabase, session, "support.ticket_updated", "support_ticket", id, `Ticket « ${data.subject} » modifié`, { previousStatus: before?.status ?? null, status: data.status, previousPriority: before?.priority ?? null, priority: data.priority, assignedTo: data.assigned_to ?? null });
  if (data.priority === "urgent" && before?.priority !== "urgent") await runUrgentAutomation(supabase, data as Record<string, unknown>);
  return NextResponse.json({ ticket: data });
}
