import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";

const statuses = new Set(["draft","review","scheduled","published","archived"]);
const json = async (request: Request) => { try { return await request.json() as Record<string, unknown>; } catch { return null; } };
const slugify = (value: unknown) => asText(value, 220).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request, "content.read"); if (error || !supabase) return error;
  const { data, error: queryError } = await supabase.from("website_articles").select("*").order("updated_at", { ascending: false });
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ articles: data ?? [] });
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "content.write"); if (error || !supabase) return error;
  const input = await json(request); if (!input) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const title = asText(input.title, 240); const category = asText(input.category, 120); const slug = slugify(input.slug || title);
  if (!title || !category || !slug) return NextResponse.json({ error: "Titre, slug et catégorie sont obligatoires." }, { status: 422 });
  const status = statuses.has(asText(input.status, 30)) ? asText(input.status, 30) : "draft";
  const now = new Date().toISOString();
  const { data, error: insertError } = await supabase.from("website_articles").insert({
    title, slug, category, status,
    excerpt: asNullableText(input.excerpt, 600), content: asText(input.content, 40000), image_url: asNullableText(input.imageUrl, 800), featured: Boolean(input.featured),
    scheduled_at: asNullableText(input.scheduledAt, 80), published_at: status === "published" ? now : null,
    seo_title: asNullableText(input.seoTitle, 240), seo_description: asNullableText(input.seoDescription, 360), author_name: asText(input.authorName, 160) || session?.name || "MOONY Africa", updated_at: now,
  }).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  await writeAuditLog(supabase, session, "content.article_created", "article", data.id, `Article « ${data.title} » créé`, { status:data.status, category:data.category, slug:data.slug });
  return NextResponse.json({ article: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "content.write"); if (error || !supabase) return error;
  const input = await json(request); if (!input) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const id = asText(input.id, 80); if (!id) return NextResponse.json({ error: "Article introuvable." }, { status: 422 });
  const { data: before } = await supabase.from("website_articles").select("title,status,slug").eq("id",id).maybeSingle();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("title" in input) patch.title = asText(input.title, 240);
  if ("slug" in input) patch.slug = slugify(input.slug);
  if ("category" in input) patch.category = asText(input.category, 120);
  if ("excerpt" in input) patch.excerpt = asNullableText(input.excerpt, 600);
  if ("content" in input) patch.content = asText(input.content, 40000);
  if ("imageUrl" in input) patch.image_url = asNullableText(input.imageUrl, 800);
  if ("featured" in input) patch.featured = Boolean(input.featured);
  if ("scheduledAt" in input) patch.scheduled_at = asNullableText(input.scheduledAt, 80);
  if ("seoTitle" in input) patch.seo_title = asNullableText(input.seoTitle, 240);
  if ("seoDescription" in input) patch.seo_description = asNullableText(input.seoDescription, 360);
  if ("authorName" in input) patch.author_name = asText(input.authorName, 160) || session?.name || "MOONY Africa";
  const nextStatus = asText(input.status, 30);
  if (statuses.has(nextStatus)) { patch.status = nextStatus; if (nextStatus === "published") patch.published_at = new Date().toISOString(); }
  const { data, error: updateError } = await supabase.from("website_articles").update(patch).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await writeAuditLog(supabase, session, "content.article_updated", "article", id, `Article « ${data.title} » modifié`, { previousStatus:before?.status ?? null, status:data.status, slug:data.slug });
  return NextResponse.json({ article: data });
}

export async function DELETE(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "content.write"); if (error || !supabase) return error;
  const id = new URL(request.url).searchParams.get("id") || ""; if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });
  const { data: before } = await supabase.from("website_articles").select("title,status,slug").eq("id",id).maybeSingle();
  const { error: deleteError } = await supabase.from("website_articles").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  await writeAuditLog(supabase, session, "content.article_deleted", "article", id, before ? `Article « ${before.title} » supprimé` : "Article supprimé", { status:before?.status ?? null, slug:before?.slug ?? null });
  return NextResponse.json({ ok: true });
}
