import { NextResponse } from "next/server";
import { requireAdmin, writeAuditLog } from "@/lib/admin-api";
import {
  ADMIN_COOKIE,
  adminSessionMaxAgeSeconds,
  createAdminSessionToken,
  hashAdminPassword,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { revokeUserSessions } from "@/lib/control-center-sessions";

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: adminSessionMaxAgeSeconds(),
  });
}

export async function GET(request: Request) {
  const { error, supabase, session } = requireAdmin(request);
  if (error || !supabase || !session) return error;

  if (session.legacy) {
    return NextResponse.json({
      account: {
        id: session.sub,
        fullName: session.name,
        email: session.email,
        role: session.role,
        legacy: true,
        mfaRequired: false,
        mustChangePassword: false,
        lastLoginAt: null,
      },
      session: { sid: session.sid ?? null, exp: session.exp, mfa: session.mfa ?? false },
    });
  }

  const { data: user, error: userError } = await supabase
    .from("control_center_users")
    .select("id,full_name,email,active,last_login_at,metadata,role_id,must_change_password")
    .eq("id", session.sub)
    .maybeSingle();
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user || !user.active) return NextResponse.json({ error: "Compte introuvable ou désactivé." }, { status: 403 });

  const metadata = user.metadata && typeof user.metadata === "object" ? user.metadata as Record<string, unknown> : {};
  return NextResponse.json({
    account: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: session.role,
      legacy: false,
      mfaRequired: metadata.mfa_required === true,
      mustChangePassword: Boolean(user.must_change_password),
      lastLoginAt: user.last_login_at,
    },
    session: { sid: session.sid ?? null, exp: session.exp, mfa: session.mfa ?? false },
  });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request);
  if (error || !supabase || !session) return error;
  if (session.legacy) {
    return NextResponse.json({ error: "L’accès fondateur de secours est piloté par les variables d’environnement. Créez un compte nominatif pour gérer votre profil ici." }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }

  const { data: user, error: userError } = await supabase
    .from("control_center_users")
    .select("id,full_name,email,password_hash,active,metadata,must_change_password")
    .eq("id", session.sub)
    .maybeSingle();
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user || !user.active) return NextResponse.json({ error: "Compte introuvable ou désactivé." }, { status: 403 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const changes: Record<string, unknown> = {};
  const nextName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 120) : "";
  if (nextName && nextName !== user.full_name) {
    patch.full_name = nextName;
    changes.fullName = true;
  }

  if (typeof body.mfaRequired === "boolean") {
    const metadata = user.metadata && typeof user.metadata === "object" ? user.metadata as Record<string, unknown> : {};
    patch.metadata = { ...metadata, mfa_required: body.mfaRequired };
    changes.mfaRequired = body.mfaRequired;
  }

  const nextPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (nextPassword) {
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    if (!verifyAdminPassword(currentPassword, user.password_hash)) return NextResponse.json({ error: "Le mot de passe actuel est incorrect." }, { status: 401 });
    if (nextPassword.length < 12) return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 12 caractères." }, { status: 422 });
    if (currentPassword === nextPassword) return NextResponse.json({ error: "Choisissez un nouveau mot de passe différent du précédent." }, { status: 422 });
    patch.password_hash = hashAdminPassword(nextPassword);
    patch.must_change_password = false;
    changes.passwordChanged = true;
    changes.mustChangePasswordCleared = Boolean(user.must_change_password);
  }

  if (Object.keys(patch).length === 1) return NextResponse.json({ error: "Aucune modification à enregistrer." }, { status: 422 });

  const { data: updated, error: updateError } = await supabase
    .from("control_center_users")
    .update(patch)
    .eq("id", session.sub)
    .select("id,full_name,email,metadata,last_login_at,must_change_password")
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (changes.passwordChanged) await revokeUserSessions(supabase, session.sub);
  await writeAuditLog(supabase, session, "account.security_updated", "control_center_user", session.sub, "Profil ou sécurité du compte mis à jour", { ...changes, sessionsRevoked: Boolean(changes.passwordChanged) });

  const response = NextResponse.json({
    ok: true,
    reauthenticate: Boolean(changes.passwordChanged),
    account: {
      id: updated.id,
      fullName: updated.full_name,
      email: updated.email,
      role: session.role,
      mfaRequired: Boolean((updated.metadata as Record<string, unknown> | null)?.mfa_required),
      mustChangePassword: Boolean(updated.must_change_password),
      lastLoginAt: updated.last_login_at,
    },
  });

  if (changes.passwordChanged) {
    response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  } else if (changes.fullName) {
    const token = createAdminSessionToken({
      sub: session.sub,
      email: session.email,
      name: updated.full_name,
      role: session.role,
      permissions: session.permissions,
      sid: session.sid,
      legacy: session.legacy,
      mfa: session.mfa,
      mustChangePassword: session.mustChangePassword,
    });
    if (token) setSessionCookie(response, token);
  }

  return response;
}
