import { NextResponse } from "next/server";
import { getAdminSession, hasAdminPermission, isAdminAuthConfigured, type AdminPermission, type AdminSession } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export function requireAdmin(request: Request, permission?: AdminPermission) {
  if (!isAdminAuthConfigured()) {
    return { error: NextResponse.json({ error: "Le Control Center doit être sécurisé avant d’activer les écritures." }, { status: 503 }), supabase: null, session: null };
  }
  const session = getAdminSession(request);
  if (!session) {
    return { error: NextResponse.json({ error: "Session administrateur requise." }, { status: 401 }), supabase: null, session: null };
  }
  if (!hasAdminPermission(session, permission)) {
    return { error: NextResponse.json({ error: "Vous n’avez pas les droits nécessaires pour cette action." }, { status: 403 }), supabase: null, session };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase n’est pas configuré." }, { status: 503 }), supabase: null, session };
  }
  return { error: null, supabase, session };
}

export async function writeAuditLog(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  session: AdminSession | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  summary?: string | null,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.from("control_center_audit_logs").insert({
      actor_user_id: session && !session.legacy && session.sub !== "legacy-founder" ? session.sub : null,
      actor_email: session?.email ?? null,
      actor_name: session?.name ?? "MOONY Admin",
      actor_role: session?.role ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      summary: summary ?? null,
      metadata,
    });
  } catch {
    // The audit trail must never make the business action fail if the migration is not applied yet.
  }
}

export function asText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function asNullableText(value: unknown, max = 500) {
  const result = asText(value, max);
  return result || null;
}
