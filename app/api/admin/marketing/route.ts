import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin } from "@/lib/admin-api";

const kinds = new Set(["popup", "banner", "form", "campaign"]);
const statuses = new Set(["draft", "active", "scheduled", "paused", "archived"]);

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return ["/"];
  return value.map((item) => asText(item, 180)).filter(Boolean).slice(0, 30);
}

async function bodyOf(request: Request) {
  try { return (await request.json()) as Record<string, unknown>; } catch { return null; }
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const { data, error: queryError } = await supabase.from("marketing_elements").select("*").order("updated_at", { ascending: false });
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ elements: data ?? [] });
}

export async function POST(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const name = asText(body.name, 180);
  const headline = asText(body.headline, 300);
  const kind = kinds.has(asText(body.kind, 30)) ? asText(body.kind, 30) : "popup";
  const status = statuses.has(asText(body.status, 30)) ? asText(body.status, 30) : "draft";
  if (!name || !headline) return NextResponse.json({ error: "Le nom et le titre sont obligatoires." }, { status: 422 });

  const { data, error: insertError } = await supabase.from("marketing_elements").insert({
    name, kind, status,
    placement: stringArray(body.placement),
    eyebrow: asNullableText(body.eyebrow, 120),
    headline,
    body: asNullableText(body.body, 1000),
    cta_label: asNullableText(body.ctaLabel, 120),
    cta_url: asNullableText(body.ctaUrl, 500),
    collect_email: Boolean(body.collectEmail),
    start_at: asNullableText(body.startAt, 80),
    end_at: asNullableText(body.endAt, 80),
    config: typeof body.config === "object" && body.config ? body.config : {},
  }).select("*").single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ element: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const id = asText(body.id, 80);
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") patch.name = asText(body.name, 180);
  if (typeof body.kind === "string" && kinds.has(body.kind)) patch.kind = body.kind;
  if (typeof body.status === "string" && statuses.has(body.status)) patch.status = body.status;
  if (Array.isArray(body.placement)) patch.placement = stringArray(body.placement);
  if ("eyebrow" in body) patch.eyebrow = asNullableText(body.eyebrow, 120);
  if (typeof body.headline === "string") patch.headline = asText(body.headline, 300);
  if ("body" in body) patch.body = asNullableText(body.body, 1000);
  if ("ctaLabel" in body) patch.cta_label = asNullableText(body.ctaLabel, 120);
  if ("ctaUrl" in body) patch.cta_url = asNullableText(body.ctaUrl, 500);
  if ("collectEmail" in body) patch.collect_email = Boolean(body.collectEmail);
  if ("startAt" in body) patch.start_at = asNullableText(body.startAt, 80);
  if ("endAt" in body) patch.end_at = asNullableText(body.endAt, 80);
  if (typeof body.config === "object" && body.config) patch.config = body.config;

  const { data, error: updateError } = await supabase.from("marketing_elements").update(patch).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ element: data });
}

export async function DELETE(request: Request) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });
  const { error: deleteError } = await supabase.from("marketing_elements").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
