import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin } from "@/lib/admin-api";

const statuses = new Set(["todo", "in_progress", "done", "cancelled"]);
const priorities = new Set(["low", "normal", "high", "urgent"]);

async function parseBody(request: Request) {
  try { return (await request.json()) as Record<string, unknown>; } catch { return null; }
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const url = new URL(request.url);
  const leadId = url.searchParams.get("leadId")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "";
  let query = supabase.from("website_crm_tasks").select("*").order("due_at", { ascending: true, nullsFirst: false }).limit(200);
  if (leadId) query = query.eq("lead_id", leadId);
  if (status && statuses.has(status)) query = query.eq("status", status);
  const { data, error: queryError } = await query;
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const leadId = asText(body.leadId, 80);
  const title = asText(body.title, 260);
  if (!leadId || !title) return NextResponse.json({ error: "Lead et tâche obligatoires." }, { status: 422 });
  const priorityValue = asText(body.priority, 40);
  const statusValue = asText(body.status, 40);
  const { data, error: insertError } = await supabase.from("website_crm_tasks").insert({
    lead_id: leadId,
    title,
    due_at: asNullableText(body.dueAt, 80),
    status: statuses.has(statusValue) ? statusValue : "todo",
    priority: priorities.has(priorityValue) ? priorityValue : "normal",
    assigned_to: asNullableText(body.assignedTo, 180),
    notes: asNullableText(body.notes, 3000),
    metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
  }).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  await supabase.from("website_leads").update({ updated_at: new Date().toISOString() }).eq("id", leadId);
  return NextResponse.json({ task: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const id = asText(body.id, 80);
  if (!id) return NextResponse.json({ error: "Tâche manquante." }, { status: 422 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("title" in body) patch.title = asText(body.title, 260);
  if ("dueAt" in body) patch.due_at = asNullableText(body.dueAt, 80);
  if (typeof body.status === "string" && statuses.has(body.status)) {
    patch.status = body.status;
    patch.completed_at = body.status === "done" ? new Date().toISOString() : null;
  }
  if (typeof body.priority === "string" && priorities.has(body.priority)) patch.priority = body.priority;
  if ("assignedTo" in body) patch.assigned_to = asNullableText(body.assignedTo, 180);
  if ("notes" in body) patch.notes = asNullableText(body.notes, 3000);
  const { data, error: updateError } = await supabase.from("website_crm_tasks").update(patch).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function DELETE(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const id = new URL(request.url).searchParams.get("id")?.trim() || "";
  if (!id) return NextResponse.json({ error: "Tâche manquante." }, { status: 422 });
  const { error: deleteError } = await supabase.from("website_crm_tasks").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
