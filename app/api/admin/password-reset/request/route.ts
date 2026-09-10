import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hashPasswordResetToken } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] ?? char));
}

async function sendResetEmail(email: string, name: string, resetUrl: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) return false;
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey, accept: "application/json" },
    body: JSON.stringify({
      sender: { name: process.env.BREVO_SENDER_NAME || "MOONY Africa", email: senderEmail },
      to: [{ email, name }],
      subject: "Réinitialisation de votre mot de passe MOONY Control Center",
      htmlContent: `<div style="font-family:Arial,sans-serif;background:#f8f0e5;padding:32px;color:#5b2f22"><div style="max-width:560px;margin:auto;background:#fffaf4;border-radius:24px;padding:36px"><div style="font-family:Georgia,serif;font-size:26px;letter-spacing:.08em">MOONY</div><h1 style="font-family:Georgia,serif;font-weight:400;font-size:30px;margin:28px 0 12px">Réinitialiser votre mot de passe</h1><p>Bonjour ${escapeHtml(name)},</p><p>Une demande de réinitialisation a été faite pour votre compte Control Center.</p><p style="margin:28px 0"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#7e3518;color:#fff;text-decoration:none;border-radius:999px;padding:14px 22px;font-weight:600">Choisir un nouveau mot de passe</a></p><p style="font-size:13px;color:#80665d">Ce lien expire dans 20 minutes et ne peut être utilisé qu’une seule fois. Si vous n’avez rien demandé, ignorez cet e-mail.</p></div></div>`,
    }),
  });
  return response.ok;
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Le service de récupération n’est pas configuré." }, { status: 503 });
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    return NextResponse.json({ error: "Le service d’e-mails de sécurité n’est pas encore configuré." }, { status: 503 });
  }

  let body: { email?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 422 });

  const readiness = await supabase.from("control_center_password_resets").select("id").limit(1);
  if (readiness.error) return NextResponse.json({ error: "Le module de récupération doit être initialisé en base de données." }, { status: 503 });

  const generic = () => NextResponse.json({ ok: true, message: "Si un compte actif correspond à cette adresse, un e-mail de réinitialisation vient d’être envoyé." });
  const { data: user } = await supabase.from("control_center_users").select("id,full_name,email,active").ilike("email", email).maybeSingle();
  if (!user || !user.active) {
    await new Promise((resolve) => setTimeout(resolve, 220));
    return generic();
  }

  const recentSince = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await supabase.from("control_center_password_resets").select("id").eq("user_id", user.id).is("consumed_at", null).gte("created_at", recentSince).limit(1);
  if (recent?.length) return generic();

  const id = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 20 * 60_000).toISOString();
  const { error: insertError } = await supabase.from("control_center_password_resets").insert({
    id,
    user_id: user.id,
    token_hash: hashPasswordResetToken(id, token),
    expires_at: expiresAt,
  });
  if (insertError) return NextResponse.json({ error: "Impossible de préparer la réinitialisation." }, { status: 500 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const resetUrl = new URL("/admin/reinitialiser-mot-de-passe", origin);
  resetUrl.searchParams.set("id", id);
  resetUrl.searchParams.set("token", token);
  const delivered = await sendResetEmail(user.email, user.full_name, resetUrl.toString());
  if (!delivered) {
    await supabase.from("control_center_password_resets").delete().eq("id", id);
    return NextResponse.json({ error: "L’e-mail de récupération n’a pas pu être envoyé. Réessayez plus tard." }, { status: 502 });
  }

  try {
    await supabase.from("control_center_audit_logs").insert({
      actor_user_id: user.id,
      actor_email: user.email,
      actor_name: user.full_name,
      action: "password_reset.requested",
      entity_type: "control_center_user",
      entity_id: user.id,
      summary: "Réinitialisation de mot de passe demandée",
    });
  } catch {}

  return generic();
}
