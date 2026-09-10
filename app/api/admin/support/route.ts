import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin } from "@/lib/admin-api";

const statuses = new Set(["open", "in_progress", "waiting", "resolved", "closed"]);
const priorities = new Set(["low", "normal", "high", "urgent"]);
const types = new Set(["question", "request", "incident", "complaint", "feedback"]);

async function parseBody(request: Request) {
  try { return (await request.json()) as Record<string, unknown>; } catch { return null; }
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request);
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
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const email = asText(body.email, 240).toLowerCase();
  const subject = asText(body.subject, 240);
  const message = asText(body.message, 5000);
  if (!email || !email.includes("@") || !subject || !message) return NextResponse.json({ error: "E-mail, sujet et message obligatoires." }, { status: 422 });

  const type = types.has(asText(body.type, 40)) ? asText(body.type, 40) : "request";
  const priority = priorities.has(asText(body.priority, 40)) ? asText(body.priority, 40) : "normal";
  const { data, error: insertError } = await supabase.from("support_tickets").insert({
    requester_name: asNullableText(body.name, 180), requester_email: email, type, subject, message, priority, status: "open", assigned_to: asNullableText(body.assignedTo, 180), metadata: { source: "control-center" },
  }).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  await supabase.from("support_ticket_messages").insert({ ticket_id: data.id, sender_kind: "agent", sender_name: asNullableText(body.assignedTo, 180) || "Équipe MOONY", body: message });
  return NextResponse.json({ ticket: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const id = asText(body.id, 80);
  if (!id) return NextResponse.json({ error: "Ticket manquant." }, { status: 422 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.status === "string" && statuses.has(body.status)) patch.status = body.status;
  if (typeof body.priority === "string" && priorities.has(body.priority)) patch.priority = body.priority;
  if ("assignedTo" in body) patch.assigned_to = asNullableText(body.assignedTo, 180);
  if (typeof body.subject === "string") patch.subject = asText(body.subject, 240);
  if (typeof body.type === "string" && types.has(body.type)) patch.type = body.type;

  const { data, error: updateError } = await supabase.from("support_tickets").update(patch).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ticket: data });
}
