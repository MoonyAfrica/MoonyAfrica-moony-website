import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { hashAdminPassword } from "@/lib/admin-auth";

const userFields = "id,created_at,updated_at,full_name,email,role_id,active,last_login_at,metadata";

async function roleByKey(supabase: any, key: string) {
  const { data } = await supabase.from("control_center_roles").select("id,key,name,permissions").eq("key", key).maybeSingle();
  return data;
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request, "team.manage");
  if (error || !supabase) return error;

  const [{ data: roles, error: roleError }, { data: users, error: userError }] = await Promise.all([
    supabase.from("control_center_roles").select("id,key,name,description,permissions").order("name"),
    supabase.from("control_center_users").select(userFields).order("created_at", { ascending: true }),
  ]);
  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

  const roleMap = Object.fromEntries((roles ?? []).map((role: any) => [role.id, role]));
  return NextResponse.json({
    roles: roles ?? [],
    users: (users ?? []).map((user: any) => ({ ...user, role: roleMap[user.role_id] ?? null })),
  });
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "team.manage");
  if (error || !supabase) return error;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }

  const fullName = asText(body.fullName, 120);
  const email = asText(body.email, 180).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const roleKey = asText(body.roleKey, 40);
  if (!fullName || !email || !password || !roleKey) return NextResponse.json({ error: "Nom, e-mail, rôle et mot de passe sont obligatoires." }, { status: 422 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 422 });
  if (password.length < 12) return NextResponse.json({ error: "Le mot de passe doit contenir au moins 12 caractères." }, { status: 422 });

  const role = await roleByKey(supabase, roleKey);
  if (!role) return NextResponse.json({ error: "Rôle introuvable." }, { status: 422 });

  const now = new Date().toISOString();
  const { data, error: insertError } = await supabase.from("control_center_users").insert({
    full_name: fullName,
    email,
    password_hash: hashAdminPassword(password),
    role_id: role.id,
    active: true,
    updated_at: now,
  }).select(userFields).single();
  if (insertError) {
    const duplicate = insertError.message.toLowerCase().includes("duplicate") || insertError.message.toLowerCase().includes("unique");
    return NextResponse.json({ error: duplicate ? "Un compte existe déjà avec cette adresse e-mail." : insertError.message }, { status: duplicate ? 409 : 500 });
  }

  await writeAuditLog(supabase, session, "team.user_created", "control_center_user", data.id, `Compte créé pour ${fullName}`, { email, role: role.key });
  return NextResponse.json({ user: { ...data, role } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "team.manage");
  if (error || !supabase) return error;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const id = asText(body.id, 80);
  if (!id) return NextResponse.json({ error: "Compte introuvable." }, { status: 422 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const changes: Record<string, unknown> = {};
  if (typeof body.fullName === "string") { patch.full_name = asText(body.fullName, 120); changes.fullName = patch.full_name; }
  if (typeof body.active === "boolean") {
    if (session?.sub === id && body.active === false) return NextResponse.json({ error: "Vous ne pouvez pas désactiver votre propre compte." }, { status: 422 });
    patch.active = body.active; changes.active = body.active;
  }
  if (typeof body.roleKey === "string") {
    const role = await roleByKey(supabase, asText(body.roleKey, 40));
    if (!role) return NextResponse.json({ error: "Rôle introuvable." }, { status: 422 });
    patch.role_id = role.id; changes.role = role.key;
  }
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 12) return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 12 caractères." }, { status: 422 });
    patch.password_hash = hashAdminPassword(body.password); changes.passwordReset = true;
  }

  const { data, error: updateError } = await supabase.from("control_center_users").update(patch).eq("id", id).select(userFields).single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await writeAuditLog(supabase, session, "team.user_updated", "control_center_user", id, `Compte ${data.email} modifié`, changes);
  return NextResponse.json({ user: data });
}
