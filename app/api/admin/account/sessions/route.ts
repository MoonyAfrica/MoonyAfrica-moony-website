import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { revokeSession, revokeUserSessions } from "@/lib/control-center-sessions";

export async function GET(request: Request) {
  const { error, supabase, session } = requireAdmin(request);
  if (error || !supabase || !session) return error;
  if (session.legacy) return NextResponse.json({ sessions: [], available: false, legacy: true });

  if (session.sid) {
    await supabase.from("control_center_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.sid).eq("user_id", session.sub).is("revoked_at", null);
  }

  const { data, error: queryError } = await supabase
    .from("control_center_sessions")
    .select("id,created_at,last_seen_at,expires_at,revoked_at,device_label")
    .eq("user_id", session.sub)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("last_seen_at", { ascending: false })
    .limit(30);

  if (queryError) return NextResponse.json({ sessions: [], available: false, error: "Le registre des sessions doit encore être initialisé en base." });
  return NextResponse.json({
    available: true,
    currentSessionId: session.sid ?? null,
    sessions: (data ?? []).map((item) => ({ ...item, current: item.id === session.sid })),
  });
}

export async function DELETE(request: Request) {
  const { error, supabase, session } = requireAdmin(request);
  if (error || !supabase || !session) return error;
  if (session.legacy) return NextResponse.json({ error: "L’accès fondateur de secours n’utilise pas le registre des sessions." }, { status: 409 });

  const url = new URL(request.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  const mode = (url.searchParams.get("mode") ?? "").trim();
  let signedOut = false;

  if (mode === "others") {
    await revokeUserSessions(supabase, session.sub, session.sid ?? null);
    await writeAuditLog(supabase, session, "session.revoke_others", "session", session.sid ?? null, "Toutes les autres sessions ont été déconnectées");
  } else if (mode === "all") {
    await revokeUserSessions(supabase, session.sub);
    signedOut = true;
    await writeAuditLog(supabase, session, "session.revoke_all", "session", session.sid ?? null, "Toutes les sessions ont été déconnectées");
  } else if (id) {
    await revokeSession(supabase, id, session.sub);
    signedOut = id === session.sid;
    await writeAuditLog(supabase, session, "session.revoked", "session", id, signedOut ? "Session actuelle déconnectée" : "Session distante déconnectée");
  } else {
    return NextResponse.json({ error: "Session à déconnecter manquante." }, { status: 422 });
  }

  const response = NextResponse.json({ ok: true, signedOut });
  if (signedOut) response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
