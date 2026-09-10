import { NextResponse } from "next/server";
import { hashAdminPassword, verifyPasswordResetToken } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Le service de récupération n’est pas configuré." }, { status: 503 });

  let body: { id?: string; token?: string; password?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }

  const id = (body.id ?? "").trim();
  const token = (body.token ?? "").trim();
  const password = body.password ?? "";
  if (!id || !token) return NextResponse.json({ error: "Lien de réinitialisation invalide." }, { status: 422 });
  if (password.length < 12) return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 12 caractères." }, { status: 422 });

  const { data: reset, error: resetError } = await supabase
    .from("control_center_password_resets")
    .select("id,user_id,token_hash,expires_at,consumed_at")
    .eq("id", id)
    .maybeSingle();
  if (resetError) return NextResponse.json({ error: "Le service de récupération est indisponible." }, { status: 503 });
  if (!reset || reset.consumed_at) return NextResponse.json({ error: "Ce lien n’est plus valide." }, { status: 410 });
  if (new Date(reset.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "Ce lien a expiré. Demandez-en un nouveau." }, { status: 410 });
  if (!verifyPasswordResetToken(id, token, reset.token_hash)) return NextResponse.json({ error: "Lien de réinitialisation invalide." }, { status: 401 });

  const { data: user, error: userError } = await supabase.from("control_center_users").select("id,full_name,email,active,metadata").eq("id", reset.user_id).maybeSingle();
  if (userError || !user || !user.active) return NextResponse.json({ error: "Ce compte n’est plus disponible." }, { status: 403 });

  const metadata = user.metadata && typeof user.metadata === "object" ? user.metadata as Record<string, unknown> : {};
  const now = new Date().toISOString();
  const { error: passwordError } = await supabase.from("control_center_users").update({
    password_hash: hashAdminPassword(password),
    metadata: { ...metadata, failed_login_attempts: 0, locked_until: null, password_reset_at: now },
    updated_at: now,
  }).eq("id", user.id);
  if (passwordError) return NextResponse.json({ error: passwordError.message }, { status: 500 });

  await Promise.all([
    supabase.from("control_center_password_resets").update({ consumed_at: now }).eq("id", id),
    supabase.from("control_center_password_resets").update({ consumed_at: now }).eq("user_id", user.id).is("consumed_at", null),
    supabase.from("control_center_login_challenges").delete().eq("user_id", user.id),
  ]);

  try {
    await supabase.from("control_center_audit_logs").insert({
      actor_user_id: user.id,
      actor_email: user.email,
      actor_name: user.full_name,
      action: "password_reset.completed",
      entity_type: "control_center_user",
      entity_id: user.id,
      summary: "Mot de passe réinitialisé depuis un lien de récupération",
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
