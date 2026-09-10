import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin } from "@/lib/admin-api";

const statuses = new Set(["pending", "confirmed", "completed", "cancelled", "no_show"]);

async function parseBody(request: Request) {
  try { return (await request.json()) as Record<string, unknown>; } catch { return null; }
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;

  const [{ data: appointments, error: appointmentError }, { data: leads, error: leadError }] = await Promise.all([
    supabase.from("website_appointments").select("id,created_at,lead_id,starts_at,ends_at,provider,provider_event_id,status,meeting_url,notes,metadata,website_leads(first_name,last_name,email,company,assigned_to)").order("starts_at", { ascending: true }).limit(250),
    supabase.from("website_leads").select("id,first_name,last_name,email,company,assigned_to,status").order("created_at", { ascending: false }).limit(150),
  ]);
  if (appointmentError) return NextResponse.json({ error: appointmentError.message }, { status: 500 });
  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
  return NextResponse.json({ appointments: appointments ?? [], leads: leads ?? [] });
}

export async function POST(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const startsAt = asText(body.startsAt, 80);
  if (!startsAt) return NextResponse.json({ error: "La date du rendez-vous est obligatoire." }, { status: 422 });
  const status = statuses.has(asText(body.status, 40)) ? asText(body.status, 40) : "pending";
  const { data, error: insertError } = await supabase.from("website_appointments").insert({
    lead_id: asNullableText(body.leadId, 80),
    starts_at: startsAt,
    ends_at: asNullableText(body.endsAt, 80),
    provider: asNullableText(body.provider, 120) || "Control Center",
    provider_event_id: asNullableText(body.providerEventId, 180),
    status,
    meeting_url: asNullableText(body.meetingUrl, 500),
    notes: asNullableText(body.notes, 3000),
    metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
  }).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  if (data.lead_id) await supabase.from("website_leads").update({ status: "appointment", updated_at: new Date().toISOString() }).eq("id", data.lead_id);
  return NextResponse.json({ appointment: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const id = asText(body.id, 80);
  if (!id) return NextResponse.json({ error: "Rendez-vous manquant." }, { status: 422 });

  const patch: Record<string, unknown> = {};
  if ("leadId" in body) patch.lead_id = asNullableText(body.leadId, 80);
  if (typeof body.startsAt === "string") patch.starts_at = asNullableText(body.startsAt, 80);
  if ("endsAt" in body) patch.ends_at = asNullableText(body.endsAt, 80);
  if ("provider" in body) patch.provider = asNullableText(body.provider, 120);
  if (typeof body.status === "string" && statuses.has(body.status)) patch.status = body.status;
  if ("meetingUrl" in body) patch.meeting_url = asNullableText(body.meetingUrl, 500);
  if ("notes" in body) patch.notes = asNullableText(body.notes, 3000);

  const { data, error: updateError } = await supabase.from("website_appointments").update(patch).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ appointment: data });
}

export async function DELETE(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });
  const { error: deleteError } = await supabase.from("website_appointments").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
