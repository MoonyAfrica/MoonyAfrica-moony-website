import { NextResponse } from "next/server";
import { isAdminAuthConfigured, isAdminRequest } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export function requireAdmin(request: Request) {
  if (!isAdminAuthConfigured()) {
    return { error: NextResponse.json({ error: "Le Control Center doit être sécurisé avant d’activer les écritures." }, { status: 503 }), supabase: null };
  }
  if (!isAdminRequest(request)) {
    return { error: NextResponse.json({ error: "Session administrateur requise." }, { status: 401 }), supabase: null };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase n’est pas configuré." }, { status: 503 }), supabase: null };
  }
  return { error: null, supabase };
}

export function asText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function asNullableText(value: unknown, max = 500) {
  const result = asText(value, max);
  return result || null;
}
