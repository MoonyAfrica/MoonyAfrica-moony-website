import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin } from "@/lib/admin-api";

const knownKeys = ["general","integrations","privacy","branding"] as const;

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
  const current = new Date().toISOString();
  const rows = knownKeys.filter((key) => key in body).map((key) => {
    const value = body[key];
    return { key, value: typeof value === "object" && value ? value : {}, updated_at: current };
  });
  if (!rows.length) return NextResponse.json({ error: "Aucun réglage à enregistrer." }, { status: 422 });
  const { error: upsertError } = await supabase.from("website_settings").upsert(rows, { onConflict: "key" });
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  return NextResponse.json({ ok: true, updatedAt: current });
}

export function sanitizeGeneralSettings(input: unknown) {
  const value = typeof input === "object" && input ? input as Record<string, unknown> : {};
  return {
    siteName: asText(value.siteName, 180) || "MOONY Africa",
    email: asText(value.email, 240),
    phone: asNullableText(value.phone, 80),
    whatsapp: asNullableText(value.whatsapp, 120),
    publicUrl: asText(value.publicUrl, 500),
    appUrl: asText(value.appUrl, 500),
  };
}
