import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin } from "@/lib/admin-api";

const statuses = new Set(["draft","published","archived"]);
const json = async (request: Request) => { try { return await request.json() as Record<string, unknown>; } catch { return null; } };

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request); if (error || !supabase) return error;
  const { data, error: queryError } = await supabase.from("website_partners").select("*").order("sort_order").order("created_at", { ascending: false });
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ partners: data ?? [] });
}

export async function POST(request: Request) {
  const { error, supabase } = requireAdmin(request); if (error || !supabase) return error;
  const input = await json(request); if (!input) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const name = asText(input.name, 200); if (!name) return NextResponse.json({ error: "Le nom du partenaire est obligatoire." }, { status: 422 });
  const { data, error: insertError } = await supabase.from("website_partners").insert({
    name,
    category: asNullableText(input.category, 120),
    country: asNullableText(input.country, 120),
    website_url: asNullableText(input.websiteUrl, 800),
    logo_url: asNullableText(input.logoUrl, 800),
    short_description: asNullableText(input.shortDescription, 600),
    status: statuses.has(asText(input.status, 30)) ? asText(input.status, 30) : "draft",
    featured: Boolean(input.featured),
    sort_order: Number(input.sortOrder) || 0,
    updated_at: new Date().toISOString(),
  }).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ partner: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, supabase } = requireAdmin(request); if (error || !supabase) return error;
  const input = await json(request); if (!input) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const id = asText(input.id, 80); if (!id) return NextResponse.json({ error: "Partenaire introuvable." }, { status: 422 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("name" in input) patch.name = asText(input.name, 200);
  if ("category" in input) patch.category = asNullableText(input.category, 120);
  if ("country" in input) patch.country = asNullableText(input.country, 120);
  if ("websiteUrl" in input) patch.website_url = asNullableText(input.websiteUrl, 800);
  if ("logoUrl" in input) patch.logo_url = asNullableText(input.logoUrl, 800);
  if ("shortDescription" in input) patch.short_description = asNullableText(input.shortDescription, 600);
  if (statuses.has(asText(input.status, 30))) patch.status = asText(input.status, 30);
  if ("featured" in input) patch.featured = Boolean(input.featured);
  if ("sortOrder" in input) patch.sort_order = Number(input.sortOrder) || 0;
  const { data, error: updateError } = await supabase.from("website_partners").update(patch).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ partner: data });
}

export async function DELETE(request: Request) {
  const { error, supabase } = requireAdmin(request); if (error || !supabase) return error;
  const id = new URL(request.url).searchParams.get("id") || ""; if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });
  const { error: deleteError } = await supabase.from("website_partners").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
