import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request, "audit.read");
  if (error || !supabase) return error;
  const url = new URL(request.url);
  const actor = url.searchParams.get("actor")?.trim() || "";
  const entity = url.searchParams.get("entity")?.trim() || "";
  const action = url.searchParams.get("action")?.trim() || "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 250);

  let query = supabase
    .from("control_center_audit_logs")
    .select("id,created_at,actor_user_id,actor_email,actor_name,actor_role,action,entity_type,entity_id,summary,metadata")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (actor) query = query.ilike("actor_email", `%${actor}%`);
  if (entity) query = query.eq("entity_type", entity);
  if (action) query = query.eq("action", action);
  const { data, error: queryError } = await query;
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}
