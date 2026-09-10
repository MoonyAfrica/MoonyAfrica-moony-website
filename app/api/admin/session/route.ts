import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminSessionMaxAgeSeconds,
  createAdminSessionToken,
  getAdminSession,
  hashMfaCode,
  isAdminAuthConfigured,
  isGlobalMfaRequired,
  legacyFounderSession,
  validateAdminPassword,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { createStoredAdminSession, revokeSession } from "@/lib/control-center-sessions";
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

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] ?? char));
}

function metadataOf(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

async function findTeamUser(supabase: any, email: string) {
  const full = await supabase.from("control_center_users").select("id,full_name,email,password_hash,active,role_id,metadata,must_change_password").ilike("email", email).maybeSingle();
  if (!full.error) return full.data;
  const fallback = await supabase.from("control_center_users").select("id,full_name,email,password_hash,active,role_id,metadata").ilike("email", email).maybeSingle();
  return fallback.data ? { ...fallback.data, must_change_password: false } : null;
}

async function sendMfaEmail(email: string, name: string, code: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) return false;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey, accept: "application/json" },
    body: JSON.stringify({
      sender: { name: process.env.BREVO_SENDER_NAME || "MOONY Africa", email: senderEmail },
      to: [{ email, name }],
      subject: "Votre code de sécurité MOONY Control Center",
      htmlContent: `<div style="font-family:Arial,sans-serif;background:#f8f0e5;padding:32px;color:#5b2f22"><div style="max-width:560px;margin:auto;background:#fffaf4;border-radius:24px;padding:36px"><div style="font-family:Georgia,serif;font-size:26px;letter-spacing:.08em">MOONY</div><h1 style="font-family:Georgia,serif;font-weight:400;font-size:30px;margin:28px 0 12px">Code de vérification</h1><p>Bonjour ${escapeHtml(name)},</p><p>Utilisez ce code pour terminer votre connexion au Control Center.</p><div style="font-size:34px;font-weight:700;letter-spacing:.18em;margin:28px 0;color:#7e3518">${code}</div><p style="font-size:13px;color:#80665d">Ce code expire dans 10 minutes. Si vous n’êtes pas à l’origine de cette connexion, ne partagez pas ce code.</p></div></div>`,
    }),
  });
  return response.ok;
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
      const user = await findTeamUser(supabase, email);

      if (user) {
        if (!user.active) return NextResponse.json({ error: "Ce compte est désactivé." }, { status: 403 });

        const metadata = metadataOf(user.metadata);
        const lockedUntil = typeof metadata.locked_until === "string" ? new Date(metadata.locked_until) : null;
        if (lockedUntil && lockedUntil.getTime() > Date.now()) {
          return NextResponse.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
        }

        if (!verifyAdminPassword(password, user.password_hash)) {
          const attempts = Number.isFinite(Number(metadata.failed_login_attempts)) ? Number(metadata.failed_login_attempts) + 1 : 1;
          const shouldLock = attempts >= 5;
          const nextMetadata = {
            ...metadata,
            failed_login_attempts: shouldLock ? 0 : attempts,
            locked_until: shouldLock ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
          };
          await supabase.from("control_center_users").update({ metadata: nextMetadata, updated_at: new Date().toISOString() }).eq("id", user.id);
          try {
            await supabase.from("control_center_audit_logs").insert({
              actor_user_id: user.id,
              actor_email: user.email,
              actor_name: user.full_name,
              action: shouldLock ? "login.locked" : "login.failed",
              entity_type: "session",
              entity_id: user.id,
              summary: shouldLock ? "Compte temporairement verrouillé après plusieurs échecs de connexion" : "Échec de connexion au Control Center",
              metadata: { failedAttempts: shouldLock ? 5 : attempts },
            });
          } catch {}
          return NextResponse.json({ error: shouldLock ? "Trop de tentatives. Le compte est verrouillé pendant 15 minutes." : "Identifiants incorrects." }, { status: shouldLock ? 429 : 401 });
        }

        const { data: role } = await supabase
          .from("control_center_roles")
          .select("key,name,permissions")
          .eq("id", user.role_id)
          .maybeSingle();
        if (!role) return NextResponse.json({ error: "Le rôle de ce compte est introuvable." }, { status: 403 });

        const permissions = Array.isArray(role.permissions) ? role.permissions.filter((value): value is string => typeof value === "string") : [];
        const cleanMetadata = { ...metadata, failed_login_attempts: 0, locked_until: null };
        const mfaRequired = isGlobalMfaRequired() || metadata.mfa_required === true;
        await supabase.from("control_center_users").update({ metadata: cleanMetadata, updated_at: new Date().toISOString() }).eq("id", user.id);

        if (mfaRequired) {
          if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
            return NextResponse.json({ error: "La double authentification est activée mais l’envoi d’e-mails de sécurité n’est pas configuré." }, { status: 503 });
          }

          const recentSince = new Date(Date.now() - 45_000).toISOString();
          const { data: recent } = await supabase.from("control_center_login_challenges").select("id,created_at").eq("user_id", user.id).is("consumed_at", null).gte("created_at", recentSince).order("created_at", { ascending: false }).limit(1);
          if (recent?.length) return NextResponse.json({ error: "Un code vient déjà d’être envoyé. Patientez quelques secondes avant de recommencer." }, { status: 429 });

          const challengeId = randomUUID();
          const code = String(randomInt(100000, 1_000_000));
          const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
          const { error: challengeError } = await supabase.from("control_center_login_challenges").insert({
            id: challengeId,
            user_id: user.id,
            code_hash: hashMfaCode(challengeId, code),
            expires_at: expiresAt,
            attempts: 0,
          });
          if (challengeError) return NextResponse.json({ error: "Le service de double authentification n’est pas encore prêt. Appliquez la migration de sécurité du Control Center." }, { status: 503 });

          const delivered = await sendMfaEmail(user.email, user.full_name, code);
          if (!delivered) {
            await supabase.from("control_center_login_challenges").delete().eq("id", challengeId);
            return NextResponse.json({ error: "Le code de sécurité n’a pas pu être envoyé. Vérifiez la configuration Brevo." }, { status: 502 });
          }

          try {
            await supabase.from("control_center_audit_logs").insert({
              actor_user_id: user.id,
              actor_email: user.email,
              actor_name: user.full_name,
              actor_role: role.key,
              action: "login.mfa_challenge",
              entity_type: "session",
              entity_id: user.id,
              summary: "Code de double authentification envoyé",
            });
          } catch {}

          return NextResponse.json({ mfaRequired: true, challengeId, email: maskEmail(user.email), expiresAt });
        }

        const mustChangePassword = Boolean(user.must_change_password);
        const stored = await createStoredAdminSession(supabase, user.id, request, mustChangePassword);
        const session = { sub: user.id, email: user.email, name: user.full_name, role: role.key, permissions, mfa: false, sid: stored?.id, mustChangePassword };
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
            entity_id: stored?.id ?? user.id,
            summary: "Connexion au Control Center",
            metadata: { mfa: false, revocableSession: Boolean(stored), mustChangePassword },
          });
        } catch {}

        return sessionResponse(token, { ok: true, session: { ...session, roleName: role.name }, mustChangePassword });
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

export async function DELETE(request: Request) {
  const session = getAdminSession(request);
  const supabase = getSupabaseAdmin();
  if (session && supabase) {
    if (session.sid) await revokeSession(supabase, session.sid, session.sub);
    try {
      await supabase.from("control_center_audit_logs").insert({
        actor_user_id: !session.legacy && session.sub !== "legacy-founder" ? session.sub : null,
        actor_email: session.email,
        actor_name: session.name,
        actor_role: session.role,
        action: "logout",
        entity_type: "session",
        entity_id: session.sid ?? session.sub,
        summary: "Déconnexion du Control Center",
      });
    } catch {}
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
