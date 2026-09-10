import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import type { AdminSession } from "@/lib/admin-auth";

const allowedStatuses = new Set(["draft", "published", "archived"]);
const pageFields = "id,title,slug,status,seo_title,seo_description,hero,sections,metadata,created_at,updated_at";
type VersionAction = "create" | "save" | "publish" | "unpublish" | "archive" | "restore";
type AdminSupabase = NonNullable<ReturnType<typeof requireAdmin>["supabase"]>;

function cleanSlug(value: unknown) {
  const raw = asText(value, 220) || "/";
  if (raw === "/") return "/";
  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
}

async function jsonBody(request: Request) {
  try { return (await request.json()) as Record<string, unknown>; } catch { return null; }
}

function actionFor(previousStatus: string | undefined, nextStatus: string | undefined): VersionAction {
  if (nextStatus === "published" && previousStatus !== "published") return "publish";
  if (previousStatus === "published" && nextStatus === "draft") return "unpublish";
  if (nextStatus === "archived" && previousStatus !== "archived") return "archive";
  return "save";
}

async function saveVersion(supabase: AdminSupabase, pageId: string, snapshot: Record<string, unknown>, action: VersionAction, session: AdminSession | null, note?: string) {
  try {
    await supabase.from("website_page_versions").insert({
      page_id: pageId,
      action,
      created_by: session?.name || session?.email || "MOONY Admin",
      note: note || null,
      snapshot,
    });
  } catch {
    // Best effort until the page-version migration is applied in Supabase.
  }
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request, "site.read");
  if (error || !supabase) return error;
  const id = new URL(request.url).searchParams.get("id")?.trim() || "";

  if (id) {
    const { data, error: queryError } = await supabase.from("website_pages").select(pageFields).eq("id", id).maybeSingle();
    if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
    return NextResponse.json({ page: data });
  }

  const { data, error: queryError } = await supabase.from("website_pages").select(pageFields).order("updated_at", { ascending: false });
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ pages: data ?? [] });
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "site.write");
  if (error || !supabase) return error;
  const body = await jsonBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const title = asText(body.title, 180);
  const slug = cleanSlug(body.slug);
  const status = allowedStatuses.has(asText(body.status, 30)) ? asText(body.status, 30) : "draft";
  if (!title) return NextResponse.json({ error: "Le titre est obligatoire." }, { status: 422 });

  const { data, error: insertError } = await supabase
    .from("website_pages")
    .insert({
      title,
      slug,
      status,
      seo_title: asNullableText(body.seoTitle, 240),
      seo_description: asNullableText(body.seoDescription, 360),
      hero: typeof body.hero === "object" && body.hero ? body.hero : {},
      sections: Array.isArray(body.sections) ? body.sections : [],
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
      updated_at: new Date().toISOString(),
    })
    .select(pageFields)
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  await saveVersion(supabase, data.id, data as Record<string, unknown>, "create", session, "Création initiale de la page.");
  await writeAuditLog(supabase, session, "cms.page_created", "website_page", data.id, `Page « ${data.title} » créée`, { slug: data.slug, status: data.status });
  return NextResponse.json({ page: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "site.write");
  if (error || !supabase) return error;
  const body = await jsonBody(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const id = asText(body.id, 80);
  if (!id) return NextResponse.json({ error: "Page introuvable." }, { status: 422 });

  const { data: current, error: currentError } = await supabase.from("website_pages").select(pageFields).eq("id", id).maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") patch.title = asText(body.title, 180);
  if (typeof body.slug === "string") patch.slug = cleanSlug(body.slug);
  if (typeof body.status === "string" && allowedStatuses.has(body.status)) patch.status = body.status;
  if ("seoTitle" in body) patch.seo_title = asNullableText(body.seoTitle, 240);
  if ("seoDescription" in body) patch.seo_description = asNullableText(body.seoDescription, 360);
  if (typeof body.hero === "object" && body.hero) patch.hero = body.hero;
  if (Array.isArray(body.sections)) patch.sections = body.sections;
  if (typeof body.metadata === "object" && body.metadata) patch.metadata = body.metadata;

  const nextStatus = typeof patch.status === "string" ? patch.status : current.status;
  const action = actionFor(current.status, nextStatus);
  await saveVersion(supabase, id, current as Record<string, unknown>, action, session);

  const { data, error: updateError } = await supabase.from("website_pages").update(patch).eq("id", id).select(pageFields).single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await writeAuditLog(supabase, session, `cms.${action}`, "website_page", id, `Page « ${data.title} » modifiée`, { slug: data.slug, previousStatus: current.status, status: data.status });
  return NextResponse.json({ page: data });
}

export async function DELETE(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "site.write");
  if (error || !supabase) return error;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });
  const { data: current } = await supabase.from("website_pages").select("id,title,slug").eq("id", id).maybeSingle();
  const { error: deleteError } = await supabase.from("website_pages").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  await writeAuditLog(supabase, session, "cms.page_deleted", "website_page", id, current ? `Page « ${current.title} » supprimée` : "Page supprimée", { slug: current?.slug ?? null });
  return NextResponse.json({ ok: true });
}
