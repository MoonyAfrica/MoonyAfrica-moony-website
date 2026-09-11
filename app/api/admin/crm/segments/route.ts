import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";

const visibilityValues = new Set(["team", "private"]);

async function bodyOf(request: Request) {
  try { return await request.json() as Record<string, unknown>; } catch { return null; }
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function cleanFilters(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const listKeys = ["statuses", "countries", "needs", "assignees", "sources", "tagIds"];
  for (const key of listKeys) {
    if (Array.isArray(source[key])) result[key] = source[key]!.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 50);
  }
  if (typeof source.query === "string") result.query = source.query.trim().slice(0, 180);
  if (source.minValue !== undefined && Number.isFinite(Number(source.minValue))) result.minValue = Number(source.minValue);
  if (source.maxValue !== undefined && Number.isFinite(Number(source.maxValue))) result.maxValue = Number(source.maxValue);
  return result;
}

function dimensions(rows: Array<Record<string, unknown>>) {
  const unique = (key: string) => [...new Set(rows.map((row) => typeof row[key] === "string" ? String(row[key]).trim() : "").filter(Boolean))].sort((a,b) => a.localeCompare(b, "fr"));
  return {
    countries: unique("country"),
    needs: unique("need"),
    assignees: unique("assigned_to"),
    sources: unique("source"),
  };
}

export async function GET(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.read");
  if (error || !supabase || !session) return error;

  const [tagsResult, segmentsResult, leadsResult] = await Promise.all([
    supabase.from("website_crm_tags").select("id,name,slug,color,created_by,created_at,updated_at").order("name", { ascending: true }),
    supabase.from("website_crm_segments").select("id,name,description,filters,view_config,visibility,owner_user_key,created_by,is_pinned,created_at,updated_at").order("is_pinned", { ascending: false }).order("updated_at", { ascending: false }),
    supabase.from("website_leads").select("country,need,assigned_to,source").limit(500),
  ]);

  const tagsAvailable = !tagsResult.error;
  const segmentsAvailable = !segmentsResult.error;
  const visibleSegments = segmentsAvailable
    ? (segmentsResult.data ?? []).filter((segment) => segment.visibility === "team" || segment.owner_user_key === session.sub)
    : [];

  return NextResponse.json({
    tags: tagsAvailable ? tagsResult.data ?? [] : [],
    segments: visibleSegments,
    dimensions: leadsResult.error ? { countries: [], needs: [], assignees: [], sources: [] } : dimensions((leadsResult.data ?? []) as Array<Record<string, unknown>>),
    tagsAvailable,
    segmentsAvailable,
  });
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write");
  if (error || !supabase || !session) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const entity = asText(body.entity, 30);

  if (entity === "tag") {
    const name = asText(body.name, 80);
    if (!name) return NextResponse.json({ error: "Le nom du tag est obligatoire." }, { status: 422 });
    const slug = slugify(name);
    const color = /^#[0-9a-f]{6}$/i.test(asText(body.color, 20)) ? asText(body.color, 20) : "#b9693d";
    const { data, error: insertError } = await supabase.from("website_crm_tags").insert({ name, slug, color, created_by: session.name || session.email || "MOONY Admin" }).select("*").single();
    if (insertError) return NextResponse.json({ error: insertError.code === "23505" ? "Ce tag existe déjà." : insertError.message }, { status: insertError.code === "23505" ? 409 : 500 });
    await writeAuditLog(supabase, session, "crm.tag_created", "crm_tag", data.id, `Tag « ${name} » créé`);
    return NextResponse.json({ tag: data }, { status: 201 });
  }

  if (entity === "segment") {
    const name = asText(body.name, 120);
    if (!name) return NextResponse.json({ error: "Le nom du segment est obligatoire." }, { status: 422 });
    const visibility = visibilityValues.has(asText(body.visibility, 20)) ? asText(body.visibility, 20) : "team";
    const viewConfig = body.viewConfig && typeof body.viewConfig === "object" && !Array.isArray(body.viewConfig) ? body.viewConfig : { view: "list", sort: "updated_desc" };
    const { data, error: insertError } = await supabase.from("website_crm_segments").insert({
      name,
      description: asNullableText(body.description, 500),
      filters: cleanFilters(body.filters),
      view_config: viewConfig,
      visibility,
      owner_user_key: session.sub,
      created_by: session.name || session.email || "MOONY Admin",
      is_pinned: Boolean(body.isPinned),
      updated_at: new Date().toISOString(),
    }).select("*").single();
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    await writeAuditLog(supabase, session, "crm.segment_created", "crm_segment", data.id, `Segment « ${name} » créé`, { visibility });
    return NextResponse.json({ segment: data }, { status: 201 });
  }

  return NextResponse.json({ error: "Type d’objet CRM invalide." }, { status: 422 });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write");
  if (error || !supabase || !session) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const entity = asText(body.entity, 30);
  const id = asText(body.id, 80);
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });

  if (entity === "tag") {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("name" in body) {
      const name = asText(body.name, 80);
      if (!name) return NextResponse.json({ error: "Nom de tag invalide." }, { status: 422 });
      patch.name = name;
      patch.slug = slugify(name);
    }
    if (typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color)) patch.color = body.color;
    const { data, error: updateError } = await supabase.from("website_crm_tags").update(patch).eq("id", id).select("*").single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    await writeAuditLog(supabase, session, "crm.tag_updated", "crm_tag", id, `Tag « ${data.name} » modifié`);
    return NextResponse.json({ tag: data });
  }

  if (entity === "segment") {
    const existing = await supabase.from("website_crm_segments").select("owner_user_key,visibility,name").eq("id", id).maybeSingle();
    if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
    if (!existing.data) return NextResponse.json({ error: "Segment introuvable." }, { status: 404 });
    if (existing.data.visibility === "private" && existing.data.owner_user_key !== session.sub) return NextResponse.json({ error: "Vous ne pouvez pas modifier ce segment privé." }, { status: 403 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("name" in body) patch.name = asText(body.name, 120);
    if ("description" in body) patch.description = asNullableText(body.description, 500);
    if ("filters" in body) patch.filters = cleanFilters(body.filters);
    if (body.viewConfig && typeof body.viewConfig === "object" && !Array.isArray(body.viewConfig)) patch.view_config = body.viewConfig;
    if (typeof body.visibility === "string" && visibilityValues.has(body.visibility)) patch.visibility = body.visibility;
    if ("isPinned" in body) patch.is_pinned = Boolean(body.isPinned);
    const { data, error: updateError } = await supabase.from("website_crm_segments").update(patch).eq("id", id).select("*").single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    await writeAuditLog(supabase, session, "crm.segment_updated", "crm_segment", id, `Segment « ${data.name} » modifié`);
    return NextResponse.json({ segment: data });
  }

  return NextResponse.json({ error: "Type d’objet CRM invalide." }, { status: 422 });
}

export async function DELETE(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write");
  if (error || !supabase || !session) return error;
  const url = new URL(request.url);
  const entity = url.searchParams.get("entity")?.trim() || "";
  const id = url.searchParams.get("id")?.trim() || "";
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });

  if (entity === "tag") {
    const before = await supabase.from("website_crm_tags").select("name").eq("id", id).maybeSingle();
    const { error: deleteError } = await supabase.from("website_crm_tags").delete().eq("id", id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    await writeAuditLog(supabase, session, "crm.tag_deleted", "crm_tag", id, before.data ? `Tag « ${before.data.name} » supprimé` : "Tag supprimé");
    return NextResponse.json({ ok: true });
  }

  if (entity === "segment") {
    const before = await supabase.from("website_crm_segments").select("name,owner_user_key,visibility").eq("id", id).maybeSingle();
    if (before.data?.visibility === "private" && before.data.owner_user_key !== session.sub) return NextResponse.json({ error: "Vous ne pouvez pas supprimer ce segment privé." }, { status: 403 });
    const { error: deleteError } = await supabase.from("website_crm_segments").delete().eq("id", id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    await writeAuditLog(supabase, session, "crm.segment_deleted", "crm_segment", id, before.data ? `Segment « ${before.data.name} » supprimé` : "Segment supprimé");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Type d’objet CRM invalide." }, { status: 422 });
}
