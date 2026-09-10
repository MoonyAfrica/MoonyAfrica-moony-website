import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin } from "@/lib/admin-api";

const statuses = new Set(["draft","published","archived"]);
const types = new Set(["guide","fiche","outil","video","webinaire","autre"]);
const body = async (request: Request) => { try { return await request.json() as Record<string, unknown>; } catch { return null; } };
const slugify = (value: unknown) => asText(value, 220).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request); if (error || !supabase) return error;
  const { data, error: queryError } = await supabase.from("website_resources").select("*").order("sort_order").order("updated_at", { ascending: false });
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ resources: data ?? [] });
}

export async function POST(request: Request) {
  const { error, supabase } = requireAdmin(request); if (error || !supabase) return error;
  const input = await body(request); if (!input) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const title = asText(input.title, 220); const category = asText(input.category, 120); const slug = slugify(input.slug || title);
  if (!title || !category || !slug) return NextResponse.json({ error: "Titre, slug et catégorie sont obligatoires." }, { status: 422 });
  const { data, error: insertError } = await supabase.from("website_resources").insert({
    title, slug, category,
    resource_type: types.has(asText(input.resourceType, 30)) ? asText(input.resourceType, 30) : "guide",
    excerpt: asNullableText(input.excerpt, 500), content: asNullableText(input.content, 12000), image_url: asNullableText(input.imageUrl, 800), file_url: asNullableText(input.fileUrl, 800),
    status: statuses.has(asText(input.status, 30)) ? asText(input.status, 30) : "draft",
    featured: Boolean(input.featured), sort_order: Number(input.sortOrder) || 0, updated_at: new Date().toISOString(),
  }).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ resource: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, supabase } = requireAdmin(request); if (error || !supabase) return error;
  const input = await body(request); if (!input) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const id = asText(input.id, 80); if (!id) return NextResponse.json({ error: "Ressource introuvable." }, { status: 422 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("title" in input) patch.title = asText(input.title, 220);
  if ("slug" in input) patch.slug = slugify(input.slug);
  if ("category" in input) patch.category = asText(input.category, 120);
  if (types.has(asText(input.resourceType, 30))) patch.resource_type = asText(input.resourceType, 30);
  if ("excerpt" in input) patch.excerpt = asNullableText(input.excerpt, 500);
  if ("content" in input) patch.content = asNullableText(input.content, 12000);
  if ("imageUrl" in input) patch.image_url = asNullableText(input.imageUrl, 800);
  if ("fileUrl" in input) patch.file_url = asNullableText(input.fileUrl, 800);
  if (statuses.has(asText(input.status, 30))) patch.status = asText(input.status, 30);
  if ("featured" in input) patch.featured = Boolean(input.featured);
  if ("sortOrder" in input) patch.sort_order = Number(input.sortOrder) || 0;
  const { data, error: updateError } = await supabase.from("website_resources").update(patch).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ resource: data });
}

export async function DELETE(request: Request) {
  const { error, supabase } = requireAdmin(request); if (error || !supabase) return error;
  const id = new URL(request.url).searchParams.get("id") || ""; if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });
  const { error: deleteError } = await supabase.from("website_resources").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
