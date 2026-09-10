import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin } from "@/lib/admin-api";

const statuses = new Set(["draft", "scheduled", "sending", "sent", "paused", "cancelled"]);

async function parseBody(request: Request) {
  try { return (await request.json()) as Record<string, unknown>; } catch { return null; }
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;

  const [{ data: campaigns, error: campaignError }, { count, error: subscriberError }] = await Promise.all([
    supabase.from("newsletter_campaigns").select("*").order("updated_at", { ascending: false }),
    supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "subscribed"),
  ]);

  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
  if (subscriberError) return NextResponse.json({ error: subscriberError.message }, { status: 500 });
  return NextResponse.json({ campaigns: campaigns ?? [], subscriberCount: count ?? 0 });
}

export async function POST(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const name = asText(body.name, 180);
  const subject = asText(body.subject, 240);
  if (!name || !subject) return NextResponse.json({ error: "Le nom et l’objet de la newsletter sont obligatoires." }, { status: 422 });

  const { data, error: insertError } = await supabase.from("newsletter_campaigns").insert({
    name,
    subject,
    preheader: asNullableText(body.preheader, 300),
    status: statuses.has(asText(body.status, 30)) ? asText(body.status, 30) : "draft",
    audience: asText(body.audience, 120) || "all",
    sender_name: asText(body.senderName, 120) || process.env.BREVO_SENDER_NAME || "MOONY Africa",
    sender_email: asNullableText(body.senderEmail, 240) || process.env.BREVO_SENDER_EMAIL || null,
    content: typeof body.content === "object" && body.content ? body.content : {},
    scheduled_at: asNullableText(body.scheduledAt, 80),
  }).select("*").single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ campaign: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const id = asText(body.id, 80);
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") patch.name = asText(body.name, 180);
  if (typeof body.subject === "string") patch.subject = asText(body.subject, 240);
  if ("preheader" in body) patch.preheader = asNullableText(body.preheader, 300);
  if (typeof body.status === "string" && statuses.has(body.status)) patch.status = body.status;
  if (typeof body.audience === "string") patch.audience = asText(body.audience, 120) || "all";
  if (typeof body.senderName === "string") patch.sender_name = asText(body.senderName, 120);
  if ("senderEmail" in body) patch.sender_email = asNullableText(body.senderEmail, 240);
  if (typeof body.content === "object" && body.content) patch.content = body.content;
  if ("scheduledAt" in body) patch.scheduled_at = asNullableText(body.scheduledAt, 80);

  const { data, error: updateError } = await supabase.from("newsletter_campaigns").update(patch).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}

export async function DELETE(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });
  const { error: deleteError } = await supabase.from("newsletter_campaigns").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
