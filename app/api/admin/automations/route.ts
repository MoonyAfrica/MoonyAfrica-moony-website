import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";

const triggers = new Set(["new_lead", "urgent_ticket", "appointment_reminder", "stale_lead"]);
const actionTypes = new Set(["create_crm_task", "notify_role", "send_email", "update_lead_stage", "add_crm_note", "run_rule"]);
const priorities = new Set(["low", "normal", "high", "urgent"]);
const severities = new Set(["info", "warning", "urgent"]);
const leadStages = new Set(["new", "to_contact", "contacted", "appointment", "proposal", "negotiation", "won", "lost"]);
const roles = new Set(["founder", "admin", "sales", "marketing", "content", "support", "analytics"]);

async function bodyOf(request: Request) {
  try { return await request.json() as Record<string, unknown>; } catch { return null; }
}

function textList(value: unknown, maxItems = 30, maxLength = 120) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asText(item, maxLength).toLowerCase()).filter(Boolean).slice(0, maxItems);
}

function numberBetween(value: unknown, min: number, max: number, fallback?: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeConditions(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result: Record<string, unknown> = {};
  const lists = ["statuses", "countries", "needs", "assignees", "sources", "priorities"] as const;
  for (const key of lists) {
    const items = textList(source[key]);
    if (items.length) result[key] = items;
  }
  const hoursBefore = numberBetween(source.hours_before, 1, 168);
  const daysWithoutContact = numberBetween(source.days_without_contact, 1, 90);
  const minDeal = numberBetween(source.min_deal_value, 0, 1_000_000_000);
  const maxDeal = numberBetween(source.max_deal_value, 0, 1_000_000_000);
  if (hoursBefore !== undefined) result.hours_before = hoursBefore;
  if (daysWithoutContact !== undefined) result.days_without_contact = daysWithoutContact;
  if (minDeal !== undefined) result.min_deal_value = minDeal;
  if (maxDeal !== undefined) result.max_deal_value = maxDeal;
  const companyContains = asText(source.company_contains, 180);
  if (companyContains) result.company_contains = companyContains;
  return result;
}

function normalizeAction(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const type = asText(source.type, 60);
  if (!actionTypes.has(type)) return null;
  const delayHours = numberBetween(source.delay_hours, 0, 720, 0) ?? 0;
  const common = { type, delay_hours: delayHours };

  if (type === "create_crm_task") return {
    ...common,
    title: asText(source.title, 240) || "Relancer {{lead}}",
    due_in_hours: numberBetween(source.due_in_hours, 0, 720, 24) ?? 24,
    priority: priorities.has(asText(source.priority, 30)) ? asText(source.priority, 30) : "normal",
    assigned_to: asText(source.assigned_to, 180),
    notes: asText(source.notes, 1000),
  };
  if (type === "notify_role") return {
    ...common,
    role: roles.has(asText(source.role, 40)) ? asText(source.role, 40) : "admin",
    user_key: asText(source.user_key, 120),
    title: asText(source.title, 240) || "Notification MOONY",
    subtitle: asText(source.subtitle, 500),
    href: asText(source.href, 500) || "/admin/activite",
    severity: severities.has(asText(source.severity, 30)) ? asText(source.severity, 30) : "info",
    expires_in_hours: numberBetween(source.expires_in_hours, 24, 2160, 168) ?? 168,
  };
  if (type === "send_email") return {
    ...common,
    to: asText(source.to, 240) || "{{email}}",
    subject: asText(source.subject, 180) || "Message de MOONY",
    body: asText(source.body, 10000),
  };
  if (type === "update_lead_stage") return {
    ...common,
    status: leadStages.has(asText(source.status, 40)) ? asText(source.status, 40) : "contacted",
  };
  if (type === "add_crm_note") return {
    ...common,
    summary: asText(source.summary, 240) || "Note automatique",
    body: asText(source.body, 4000),
  };
  return {
    ...common,
    rule_id: asText(source.rule_id, 80),
  };
}

function normalizeActions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map(normalizeAction).filter(Boolean);
}

function defaultDefinition(trigger: string) {
  if (trigger === "urgent_ticket") return {
    conditions: { priorities: ["urgent"] },
    actions: [{ type: "notify_role", role: "support", title: "Ticket support urgent", subtitle: "{{subject}} · {{requester}}", href: "/admin/service-client?ticket={{ticket_id}}", severity: "urgent", delay_hours: 0 }],
  };
  if (trigger === "appointment_reminder") return {
    conditions: { hours_before: 24 },
    actions: [{ type: "notify_role", role: "sales", title: "Rendez-vous demain", subtitle: "{{lead}} · {{appointment_time}}", href: "/admin/rendez-vous", severity: "info", delay_hours: 0 }],
  };
  if (trigger === "stale_lead") return {
    conditions: { days_without_contact: 5 },
    actions: [{ type: "create_crm_task", title: "Relancer {{lead}}", due_in_hours: 4, priority: "normal", delay_hours: 0 }, { type: "notify_role", role: "sales", title: "Prospect à relancer", subtitle: "{{lead}} n’a pas eu de suivi récent.", href: "/admin/crm?lead={{lead_id}}", severity: "warning", delay_hours: 0 }],
  };
  return {
    conditions: { statuses: ["new", "to_contact"] },
    actions: [{ type: "create_crm_task", title: "Contacter {{lead}}", due_in_hours: 24, priority: "high", delay_hours: 0 }, { type: "notify_role", role: "sales", title: "Nouveau prospect à contacter", subtitle: "{{lead}} vient d’entrer dans le CRM.", href: "/admin/crm?lead={{lead_id}}", severity: "info", delay_hours: 0 }],
  };
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request, "settings.read");
  if (error || !supabase) return error;

  const [rules, runs, jobs] = await Promise.all([
    supabase.from("control_center_automation_rules").select("*").order("created_at", { ascending: true }),
    supabase.from("control_center_automation_runs").select("id,rule_id,event_key,source_type,source_id,status,result,error,started_at,completed_at").order("started_at", { ascending: false }).limit(80),
    supabase.from("control_center_automation_jobs").select("id,rule_id,source_type,source_id,status,scheduled_at,error,created_at,completed_at").order("created_at", { ascending: false }).limit(80),
  ]);
  if (rules.error) return NextResponse.json({ error: rules.error.message }, { status: 500 });
  return NextResponse.json({
    rules: rules.data ?? [],
    runs: runs.error ? [] : (runs.data ?? []),
    runsAvailable: !runs.error,
    jobs: jobs.error ? [] : (jobs.data ?? []),
    jobsAvailable: !jobs.error,
    capabilities: {
      email: Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL),
      cron: Boolean(process.env.AUTOMATION_CRON_SECRET || process.env.CRON_SECRET),
    },
  });
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
  const conditions = "conditions" in body ? normalizeConditions(body.conditions) : defaults.conditions;
  const actions = "actions" in body ? normalizeActions(body.actions) : defaults.actions;

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
  await writeAuditLog(supabase, session, "automation.rule_created", "automation_rule", data.id, `Automatisation « ${data.name} » créée`, { triggerType, enabled: data.enabled, actions: actions.length });
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
  if ("conditions" in body) patch.conditions = normalizeConditions(body.conditions);
  if ("actions" in body) patch.actions = normalizeActions(body.actions);

  const { data, error: updateError } = await supabase.from("control_center_automation_rules").update(patch).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await writeAuditLog(supabase, session, "automation.rule_updated", "automation_rule", id, `Automatisation « ${data.name} » modifiée`, { previousEnabled: before?.enabled ?? null, enabled: data.enabled, triggerType: data.trigger_type, actions: Array.isArray(data.actions) ? data.actions.length : 0 });
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
