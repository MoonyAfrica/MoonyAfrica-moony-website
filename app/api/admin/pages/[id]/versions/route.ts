import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin } from "@/lib/admin-api";

const pageFields = "id,title,slug,status,seo_title,seo_description,hero,sections,metadata,created_at,updated_at";

type Snapshot = {
  title?: unknown;
  slug?: unknown;
  status?: unknown;
  seo_title?: unknown;
  seo_description?: unknown;
  hero?: unknown;
  sections?: unknown;
  metadata?: unknown;
};

function cleanStatus(value: unknown) {
  return value === "published" || value === "archived" ? value : "draft";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Page introuvable." }, { status: 422 });

  const { data, error: queryError } = await supabase
    .from("website_page_versions")
    .select("id,page_id,created_at,action,created_by,note,snapshot")
    .eq("page_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ versions: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, supabase } = requireAdmin(request);
  if (error || !supabase) return error;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const versionId = asText(body.versionId, 80);
  if (!id || !versionId) return NextResponse.json({ error: "Version introuvable." }, { status: 422 });

  const [{ data: current, error: currentError }, { data: version, error: versionError }] = await Promise.all([
    supabase.from("website_pages").select(pageFields).eq("id", id).maybeSingle(),
    supabase.from("website_page_versions").select("id,snapshot").eq("id", versionId).eq("page_id", id).maybeSingle(),
  ]);

  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (versionError) return NextResponse.json({ error: versionError.message }, { status: 500 });
  if (!current || !version) return NextResponse.json({ error: "Page ou version introuvable." }, { status: 404 });

  const { error: snapshotError } = await supabase.from("website_page_versions").insert({
    page_id: id,
    action: "restore",
    created_by: "MOONY Admin",
    note: "État sauvegardé automatiquement avant restauration.",
    snapshot: current,
  });
  if (snapshotError) return NextResponse.json({ error: snapshotError.message }, { status: 500 });

  const snapshot = (version.snapshot ?? {}) as Snapshot;
  const patch = {
    title: asText(snapshot.title, 180) || current.title,
    slug: asText(snapshot.slug, 220) || current.slug,
    status: cleanStatus(snapshot.status),
    seo_title: asNullableText(snapshot.seo_title, 240),
    seo_description: asNullableText(snapshot.seo_description, 360),
    hero: snapshot.hero && typeof snapshot.hero === "object" ? snapshot.hero : {},
    sections: Array.isArray(snapshot.sections) ? snapshot.sections : [],
    metadata: snapshot.metadata && typeof snapshot.metadata === "object" ? snapshot.metadata : {},
    updated_at: new Date().toISOString(),
  };

  const { data, error: restoreError } = await supabase.from("website_pages").update(patch).eq("id", id).select(pageFields).single();
  if (restoreError) return NextResponse.json({ error: restoreError.message }, { status: 500 });
  return NextResponse.json({ page: data });
}
