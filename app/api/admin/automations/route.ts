import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";

const triggers = new Set(["new_lead", "urgent_ticket", "appointment_reminder", "stale_lead"]);

async function bodyOf(request: Request) {
  try { return await request.json() as Record<string, unknown>; } catch { return null; }
}

function defaultDefinition(trigger: string) {
  if (trigger === "urgent_ticket") return {
    conditions: { priorities: ["urgent"] },
    actions: [{ type: "notify_role", role: "support", title: "Ticket support urgent", subtitle: "{{subject}} · {{requester}}", href: "/admin/service-client?ticket={{ticket_id}}", severity: "urgent" }],
  };
  if (trigger === "appointment_reminder") return {
    conditions: { hours_before: 24 },
    actions: [{ type: "notify_role", role: "sales", title: "Rendez-vous demain", subtitle: "{{lead}} · {{appointment_time}}", href: "/admin/rendez-vous", severity: "info" }],
  };
  if (trigger === "stale_lead") return {
    conditions: { days_without_contact: 5 },
    actions: [{ type: "create_crm_task", title: "Relancer {{lead}}", due_in_hours: 4, priority: "normal" }, { type: "notify_role", role: "sales", title: "Prospect à relancer", subtitle: "{{lead}} n’a pas eu de suivi récent.", href: "/admin/crm?lead={{lead_id}}", severity: "warning" }],
  };
  return {
    conditions: { statuses: ["new", "to_contact"] },
    actions: [{ type: "create_crm_task", title: "Contacter {{lead}}", due_in_hours: 24, priority: "high" }, { type: "notify_role", role: "sales", title: "Nouveau prospect à contacter", subtitle: "{{lead}} vient d’entrer dans le CRM.", href: "/admin/crm?lead={{lead_id}}", severity: "info" }],
  };
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request, "settings.read");
  if (error || !supabase) return error;

  const [rules, runs] = await Promise.all([
    supabase.from("control_center_automation_rules").select("*").order("created_at", { ascending: true }),
    supabase.from("control_center_automation_runs").select("id,rule_id,event_key,source_type,source_id,status,result,error,started_at,completed_at").order("started_at", { ascending: false }).limit(80),
  ]);
  if (rules.error) return NextResponse.json({ error: rules.error.message }, { status: 500 });
  return NextResponse.json({ rules: rules.data ?? [], runs: runs.error ? [] : (runs.data ?? []), runsAvailable: !runs.error });
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "settings.write");
  if (error || !supabase) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const name = asText(body.name, 180);
  const triggerType = asText(body.triggerType, 80);
  if (!name || !triggers.has(triggerType)) return NextResponse.json({ error: "Nom et déclencheur valide obligatoires." }, { status: 422 });
  const defaults = defaultDefinition(triggerType);
  const conditions = body.conditions && typeof body.conditions === "object" && !Array.isArray(body.conditions) ? body.conditions : defaults.conditions;
  const actions = Array.isArray(body.actions) ? body.actions : defaults.actions;

  const { data, error: insertError } = await supabase.from("control_center_automation_rules").insert({
    name,
    description: asNullableText(body.description, 500),
    trigger_type: triggerType,
    enabled: Boolean(body.enabled),
    conditions,
    actions,
    created_by: session?.name || session?.email || "MOONY Admin",
    updated_at: new Date().toISOString(),
  }).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  await writeAuditLog(supabase, session, "automation.rule_created", "automation_rule", data.id, `Automatisation « ${data.name} » créée`, { triggerType, enabled: data.enabled });
  return NextResponse.json({ rule: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "settings.write");
  if (error || !supabase) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const id = asText(body.id, 80);
  if (!id) return NextResponse.json({ error: "Automatisation introuvable." }, { status: 422 });

  const { data: before } = await supabase.from("control_center_automation_rules").select("name,enabled,trigger_type").eq("id", id).maybeSingle();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("name" in body) patch.name = asText(body.name, 180);
  if ("description" in body) patch.description = asNullableText(body.description, 500);
  if (typeof body.triggerType === "string" && triggers.has(body.triggerType)) patch.trigger_type = body.triggerType;
  if ("enabled" in body) patch.enabled = Boolean(body.enabled);
  if (body.conditions && typeof body.conditions === "object" && !Array.isArray(body.conditions)) patch.conditions = body.conditions;
  if (Array.isArray(body.actions)) patch.actions = body.actions;

  const { data, error: updateError } = await supabase.from("control_center_automation_rules").update(patch).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await writeAuditLog(supabase, session, "automation.rule_updated", "automation_rule", id, `Automatisation « ${data.name} » modifiée`, { previousEnabled: before?.enabled ?? null, enabled: data.enabled, triggerType: data.trigger_type });
  return NextResponse.json({ rule: data });
}

export async function DELETE(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "settings.write");
  if (error || !supabase) return error;
  const id = new URL(request.url).searchParams.get("id")?.trim() || "";
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });
  const { data: before } = await supabase.from("control_center_automation_rules").select("name,template_key").eq("id", id).maybeSingle();
  if (before?.template_key) return NextResponse.json({ error: "Les automatisations système peuvent être désactivées mais pas supprimées." }, { status: 409 });
  const { error: deleteError } = await supabase.from("control_center_automation_rules").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  await writeAuditLog(supabase, session, "automation.rule_deleted", "automation_rule", id, before ? `Automatisation « ${before.name} » supprimée` : "Automatisation supprimée");
  return NextResponse.json({ ok: true });
}
