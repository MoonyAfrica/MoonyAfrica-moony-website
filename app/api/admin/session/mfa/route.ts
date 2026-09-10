import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminSessionMaxAgeSeconds,
  createAdminSessionToken,
  verifyMfaCode,
} from "@/lib/admin-auth";
import { createStoredAdminSession } from "@/lib/control-center-sessions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function sessionResponse(token: string, body: Record<string, unknown>) {
  const response = NextResponse.json(body);
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: adminSessionMaxAgeSeconds(),
  });
  return response;
}

async function findUser(supabase: any, id: string) {
  const full = await supabase.from("control_center_users").select("id,full_name,email,active,role_id,must_change_password").eq("id", id).maybeSingle();
  if (!full.error) return full.data;
  const fallback = await supabase.from("control_center_users").select("id,full_name,email,active,role_id").eq("id", id).maybeSingle();
  return fallback.data ? { ...fallback.data, must_change_password: false } : null;
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase n’est pas configuré." }, { status: 503 });

  let body: { challengeId?: string; code?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }

  const challengeId = (body.challengeId ?? "").trim();
  const code = (body.code ?? "").replace(/\D/g, "").slice(0, 6);
  if (!challengeId || code.length !== 6) return NextResponse.json({ error: "Code de sécurité invalide." }, { status: 422 });

  const { data: challenge, error: challengeError } = await supabase
    .from("control_center_login_challenges")
    .select("id,user_id,code_hash,expires_at,attempts,consumed_at")
    .eq("id", challengeId)
    .maybeSingle();
  if (challengeError) return NextResponse.json({ error: "Le service de double authentification est indisponible." }, { status: 503 });
  if (!challenge || challenge.consumed_at) return NextResponse.json({ error: "Ce code n’est plus valide." }, { status: 410 });
  if (new Date(challenge.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "Ce code a expiré. Recommencez la connexion." }, { status: 410 });
  if (Number(challenge.attempts ?? 0) >= 5) return NextResponse.json({ error: "Trop de tentatives. Recommencez la connexion." }, { status: 429 });

  if (!verifyMfaCode(challengeId, code, challenge.code_hash)) {
    const attempts = Number(challenge.attempts ?? 0) + 1;
    await supabase.from("control_center_login_challenges").update({ attempts }).eq("id", challengeId);
    return NextResponse.json({ error: attempts >= 5 ? "Trop de tentatives. Recommencez la connexion." : "Code incorrect." }, { status: attempts >= 5 ? 429 : 401 });
  }

  const user = await findUser(supabase, challenge.user_id);
  if (!user) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  if (!user.active) return NextResponse.json({ error: "Ce compte est désactivé." }, { status: 403 });

  const { data: role, error: roleError } = await supabase
    .from("control_center_roles")
    .select("key,name,permissions")
    .eq("id", user.role_id)
    .maybeSingle();
  if (roleError || !role) return NextResponse.json({ error: "Rôle introuvable." }, { status: 403 });

  const permissions = Array.isArray(role.permissions) ? role.permissions.filter((value): value is string => typeof value === "string") : [];
  const mustChangePassword = Boolean(user.must_change_password);
  const stored = await createStoredAdminSession(supabase, user.id, request, mustChangePassword);
  const session = { sub: user.id, email: user.email, name: user.full_name, role: role.key, permissions, mfa: true, sid: stored?.id, mustChangePassword };
  const token = createAdminSessionToken(session);
  if (!token) return NextResponse.json({ error: "Configuration de session incomplète." }, { status: 503 });

  const now = new Date().toISOString();
  await Promise.all([
    supabase.from("control_center_login_challenges").update({ consumed_at: now }).eq("id", challengeId),
    supabase.from("control_center_users").update({ last_login_at: now, updated_at: now }).eq("id", user.id),
  ]);
  try {
    await supabase.from("control_center_audit_logs").insert({
      actor_user_id: user.id,
      actor_email: user.email,
      actor_name: user.full_name,
      actor_role: role.key,
      action: "login",
      entity_type: "session",
      entity_id: stored?.id ?? user.id,
      summary: "Connexion au Control Center avec double authentification",
      metadata: { mfa: true, revocableSession: Boolean(stored), mustChangePassword },
    });
  } catch {}

  return sessionResponse(token, { ok: true, session: { ...session, roleName: role.name }, mustChangePassword });
}
