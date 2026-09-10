import { NextResponse } from "next/server";
import { requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { hasAdminPermission, type AdminPermission } from "@/lib/admin-auth";

const knownKeys = ["general","integrations","privacy","branding","pricing","seo","navigation","footer"] as const;

function writePermission(keys: string[]): AdminPermission {
  if (keys.every((key) => ["navigation","footer","branding"].includes(key))) return "site.write";
  if (keys.every((key) => key === "seo")) return "seo.write";
  return "settings.write";
}

function readableKeys(session: ReturnType<typeof requireAdmin>["session"]) {
  if (hasAdminPermission(session,"settings.read")) return [...knownKeys];
  const keys = new Set<(typeof knownKeys)[number]>();
  if (hasAdminPermission(session,"site.read")) ["branding","navigation","footer"].forEach(key=>keys.add(key as (typeof knownKeys)[number]));
  if (hasAdminPermission(session,"seo.read")) keys.add("seo");
  return [...keys];
}

export async function GET(request: Request) {
  const { error, supabase, session } = requireAdmin(request); if (error || !supabase) return error;
  const keys=readableKeys(session);
  if(!keys.length)return NextResponse.json({settings:{}});
  const { data, error: queryError } = await supabase.from("website_settings").select("key,value,updated_at").in("key", keys);
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  const settings = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const keys = knownKeys.filter((key) => key in body);
  if (!keys.length) return NextResponse.json({ error: "Aucun réglage à enregistrer." }, { status: 422 });

  const { error, supabase, session } = requireAdmin(request, writePermission(keys)); if (error || !supabase) return error;
  const { data: existing, error: readError } = await supabase.from("website_settings").select("key,value").in("key", [...keys]);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  const existingMap = Object.fromEntries((existing ?? []).map((row) => [row.key, row.value]));
  const current = new Date().toISOString();
  const rows = keys.map((key) => {
    const previous = existingMap[key] && typeof existingMap[key] === "object" ? existingMap[key] as Record<string, unknown> : {};
    const incoming = body[key] && typeof body[key] === "object" ? body[key] as Record<string, unknown> : {};
    return { key, value: { ...previous, ...incoming }, updated_at: current };
  });
  const { error: upsertError } = await supabase.from("website_settings").upsert(rows, { onConflict: "key" });
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  await writeAuditLog(supabase, session, "settings.updated", "website_settings", keys.join(","), `Réglages modifiés : ${keys.join(", ")}`, { keys });
  return NextResponse.json({ ok: true, updatedAt: current });
}
