import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin } from "@/lib/admin-api";

const kinds = new Set(["note", "call", "email", "whatsapp", "meeting", "status", "proposal", "system"]);

async function parseBody(request: Request) {
  try { return (await request.json()) as Record<string, unknown>; } catch { return null; }
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const leadId = new URL(request.url).searchParams.get("leadId")?.trim() || "";
  if (!leadId) return NextResponse.json({ error: "Lead manquant." }, { status: 422 });
  const { data, error: queryError } = await supabase
    .from("website_crm_activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(150);
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const leadId = asText(body.leadId, 80);
  const summary = asText(body.summary, 260);
  if (!leadId || !summary) return NextResponse.json({ error: "Lead et résumé obligatoires." }, { status: 422 });
  const kindValue = asText(body.kind, 40);
  const kind = kinds.has(kindValue) ? kindValue : "note";
  const now = new Date().toISOString();
  const { data, error: insertError } = await supabase.from("website_crm_activities").insert({
    lead_id: leadId,
    kind,
    summary,
    body: asNullableText(body.body, 6000),
    outcome: asNullableText(body.outcome, 240),
    created_by: asNullableText(body.createdBy, 180) || "Équipe MOONY",
    metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
  }).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  const contactKinds = new Set(["call", "email", "whatsapp", "meeting"]);
  const leadPatch: Record<string, unknown> = { updated_at: now };
  if (contactKinds.has(kind)) leadPatch.last_contacted_at = now;
  await supabase.from("website_leads").update(leadPatch).eq("id", leadId);
  return NextResponse.json({ activity: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const id = new URL(request.url).searchParams.get("id")?.trim() || "";
  if (!id) return NextResponse.json({ error: "Activité manquante." }, { status: 422 });
  const { error: deleteError } = await supabase.from("website_crm_activities").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
