import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createAdminSessionToken,
  getAdminSession,
  isAdminAuthConfigured,
  legacyFounderSession,
  validateAdminPassword,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function sessionResponse(token: string, body: Record<string, unknown>) {
  const response = NextResponse.json(body);
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 10,
  });
  return response;
}

export async function GET(request: Request) {
  const session = getAdminSession(request);
  return NextResponse.json({ configured: isAdminAuthConfigured(), authenticated: Boolean(session), session });
}

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: "L’authentification du Control Center n’est pas configurée." }, { status: 503 });
  }

  let body: { email?: string; password?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!password) return NextResponse.json({ error: "Mot de passe requis." }, { status: 422 });

  const supabase = getSupabaseAdmin();
  if (supabase && email) {
    try {
      const { data: user } = await supabase
        .from("control_center_users")
        .select("id,full_name,email,password_hash,active,role_id")
        .ilike("email", email)
        .maybeSingle();

      if (user) {
        if (!user.active) return NextResponse.json({ error: "Ce compte est désactivé." }, { status: 403 });
        if (!verifyAdminPassword(password, user.password_hash)) return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });

        const { data: role } = await supabase
          .from("control_center_roles")
          .select("key,name,permissions")
          .eq("id", user.role_id)
          .maybeSingle();
        if (!role) return NextResponse.json({ error: "Le rôle de ce compte est introuvable." }, { status: 403 });

        const permissions = Array.isArray(role.permissions) ? role.permissions.filter((value): value is string => typeof value === "string") : [];
        const session = { sub: user.id, email: user.email, name: user.full_name, role: role.key, permissions };
        const token = createAdminSessionToken(session);
        if (!token) return NextResponse.json({ error: "Configuration de session incomplète." }, { status: 503 });

        const now = new Date().toISOString();
        await supabase.from("control_center_users").update({ last_login_at: now, updated_at: now }).eq("id", user.id);
        try {
          await supabase.from("control_center_audit_logs").insert({
            actor_user_id: user.id,
            actor_email: user.email,
            actor_name: user.full_name,
            actor_role: role.key,
            action: "login",
            entity_type: "session",
            entity_id: user.id,
            summary: "Connexion au Control Center",
          });
        } catch {}

        return sessionResponse(token, { ok: true, session: { ...session, roleName: role.name } });
      }
    } catch {
      // If team tables are not available yet, legacy founder access below remains usable for bootstrap.
    }
  }

  if (!validateAdminPassword(password)) {
    return NextResponse.json({ error: email ? "Identifiants incorrects." : "Mot de passe incorrect." }, { status: 401 });
  }

  const founder = legacyFounderSession();
  const token = createAdminSessionToken(founder);
  if (!token) return NextResponse.json({ error: "Configuration incomplète." }, { status: 503 });
  return sessionResponse(token, { ok: true, session: founder, bootstrap: true });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
