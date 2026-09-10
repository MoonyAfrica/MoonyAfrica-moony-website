import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

const knownKeys = ["general","integrations","privacy","branding","pricing","seo","navigation","footer"] as const;

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request); if (error || !supabase) return error;
  const { data, error: queryError } = await supabase.from("website_settings").select("key,value,updated_at").in("key", [...knownKeys]);
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  const settings = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const { error, supabase } = requireAdmin(request); if (error || !supabase) return error;
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const keys = knownKeys.filter((key) => key in body);
  if (!keys.length) return NextResponse.json({ error: "Aucun réglage à enregistrer." }, { status: 422 });
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
  return NextResponse.json({ ok: true, updatedAt: current });
}
