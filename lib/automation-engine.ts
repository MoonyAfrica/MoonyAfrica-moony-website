import { getSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
type TriggerType = "new_lead" | "urgent_ticket" | "appointment_reminder" | "stale_lead";
type AutomationRule = {
  id: string;
  name: string;
  trigger_type: TriggerType;
  enabled: boolean;
  conditions: Record<string, unknown> | null;
  actions: unknown;
};

type AutomationPayload = Record<string, unknown> & {
  lead_id?: string;
  ticket_id?: string;
  appointment_id?: string;
};

type RunResult = { ruleId: string; ruleName: string; status: "success" | "failed" | "skipped"; sourceId?: string; actions?: number; error?: string };

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function relation(value: unknown) {
  if (Array.isArray(value)) return object(value[0]);
  return object(value);
}

function render(template: unknown, payload: AutomationPayload) {
  if (typeof template !== "string") return "";
  return template.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, key: string) => {
    const value = payload[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

function leadLabel(row: Record<string, unknown>) {
  const company = stringValue(row.company);
  const person = `${stringValue(row.first_name)} ${stringValue(row.last_name)}`.trim();
  return company || person || "Prospect";
}

function conditionsMatch(rule: AutomationRule, payload: AutomationPayload) {
  const conditions = object(rule.conditions);
  if (rule.trigger_type === "new_lead") {
    const statuses = Array.isArray(conditions.statuses) ? conditions.statuses.map(String) : ["new", "to_contact"];
    return statuses.includes(stringValue(payload.status, "new"));
  }
  if (rule.trigger_type === "urgent_ticket") {
    const priorities = Array.isArray(conditions.priorities) ? conditions.priorities.map(String) : ["urgent"];
    return priorities.includes(stringValue(payload.priority));
  }
  return true;
}

async function auditAutomation(supabase: SupabaseAdmin, rule: AutomationRule, sourceType: string, sourceId: string, actionCount: number) {
  try {
    await supabase.from("control_center_audit_logs").insert({
      actor_name: "Automatisation MOONY",
      actor_role: "system",
      action: "automation.executed",
      entity_type: sourceType,
      entity_id: sourceId,
      summary: `${rule.name} exécutée`,
      metadata: { ruleId: rule.id, triggerType: rule.trigger_type, actions: actionCount },
    });
  } catch {
    // Automation must remain functional if the audit migration is not available yet.
  }
}

async function executeRule(supabase: SupabaseAdmin, rule: AutomationRule, eventKey: string, sourceType: string, sourceId: string, payload: AutomationPayload): Promise<RunResult> {
  if (!conditionsMatch(rule, payload)) return { ruleId: rule.id, ruleName: rule.name, status: "skipped", sourceId };

  const reservation = await supabase.from("control_center_automation_runs").insert({
    rule_id: rule.id,
    event_key: eventKey,
    source_type: sourceType,
    source_id: sourceId,
    status: "running",
  }).select("id").single();

  if (reservation.error) {
    if (reservation.error.code === "23505") return { ruleId: rule.id, ruleName: rule.name, status: "skipped", sourceId };
    return { ruleId: rule.id, ruleName: rule.name, status: "failed", sourceId, error: reservation.error.message };
  }

  const runId = reservation.data.id as string;
  const actions = Array.isArray(rule.actions) ? rule.actions : [];
  let executed = 0;
  const details: Array<Record<string, unknown>> = [];

  try {
    for (const rawAction of actions) {
      const action = object(rawAction);
      const type = stringValue(action.type);

      if (type === "create_crm_task") {
        const leadId = stringValue(payload.lead_id);
        if (!leadId) continue;
        const dueHours = Math.max(0, numberValue(action.due_in_hours, 24));
        const dueAt = new Date(Date.now() + dueHours * 60 * 60 * 1000).toISOString();
        const title = render(action.title || "Relancer {{lead}}", payload) || "Relance commerciale";
        const priority = ["low", "normal", "high", "urgent"].includes(stringValue(action.priority)) ? stringValue(action.priority) : "normal";
        const task = await supabase.from("website_crm_tasks").insert({
          lead_id: leadId,
          title,
          due_at: dueAt,
          status: "todo",
          priority,
          assigned_to: stringValue(payload.assigned_to) || null,
          notes: `Créée automatiquement par « ${rule.name} »`,
          metadata: { automation_rule_id: rule.id, automation_run_id: runId },
        }).select("id").single();
        if (task.error) throw new Error(task.error.message);
        executed += 1;
        details.push({ type, id: task.data.id, title, dueAt });
      }

      if (type === "notify_role") {
        const title = render(action.title, payload) || rule.name;
        const subtitle = render(action.subtitle, payload) || null;
        const href = render(action.href, payload) || "/admin/activite";
        const severity = ["info", "warning", "urgent"].includes(stringValue(action.severity)) ? stringValue(action.severity) : "info";
        const notification = await supabase.from("control_center_generated_notifications").insert({
          automation_rule_id: rule.id,
          target_role: stringValue(action.role) || null,
          target_user_key: stringValue(action.user_key) || null,
          title,
          subtitle,
          href,
          severity,
          source_type: sourceType,
          source_id: sourceId,
          expires_at: new Date(Date.now() + Math.max(24, numberValue(action.expires_in_hours, 168)) * 60 * 60 * 1000).toISOString(),
        }).select("id").single();
        if (notification.error) throw new Error(notification.error.message);
        executed += 1;
        details.push({ type, id: notification.data.id, title });
      }
    }

    const completedAt = new Date().toISOString();
    await Promise.all([
      supabase.from("control_center_automation_runs").update({ status: "success", result: { actions: details }, completed_at: completedAt }).eq("id", runId),
      supabase.from("control_center_automation_rules").update({ last_run_at: completedAt }).eq("id", rule.id),
    ]);
    try {
      const current = await supabase.from("control_center_automation_rules").select("run_count").eq("id", rule.id).maybeSingle();
      if (!current.error && current.data) await supabase.from("control_center_automation_rules").update({ run_count: Number(current.data.run_count || 0) + 1 }).eq("id", rule.id);
    } catch {}
    await auditAutomation(supabase, rule, sourceType, sourceId, executed);
    return { ruleId: rule.id, ruleName: rule.name, status: "success", sourceId, actions: executed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur d’automatisation";
    await supabase.from("control_center_automation_runs").update({ status: "failed", error: message.slice(0, 1000), completed_at: new Date().toISOString() }).eq("id", runId);
    return { ruleId: rule.id, ruleName: rule.name, status: "failed", sourceId, error: message };
  }
}

async function enabledRules(supabase: SupabaseAdmin, triggerTypes?: TriggerType[], ruleId?: string) {
  let query = supabase.from("control_center_automation_rules").select("id,name,trigger_type,enabled,conditions,actions").eq("enabled", true);
  if (ruleId) query = query.eq("id", ruleId);
  if (triggerTypes?.length) query = query.in("trigger_type", triggerTypes);
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as AutomationRule[];
}

export async function triggerAutomationEvent(supabase: SupabaseAdmin, triggerType: Extract<TriggerType, "new_lead" | "urgent_ticket">, sourceType: string, sourceId: string, payload: AutomationPayload) {
  let rules: AutomationRule[] = [];
  try { rules = await enabledRules(supabase, [triggerType]); } catch { return [] as RunResult[]; }
  const eventKey = triggerType === "urgent_ticket" ? `urgent:${sourceId}` : `created:${sourceId}`;
  return Promise.all(rules.map((rule) => executeRule(supabase, rule, eventKey, sourceType, sourceId, payload)));
}

export async function runScheduledAutomations(supabase: SupabaseAdmin, ruleId?: string) {
  const rules = await enabledRules(supabase, undefined, ruleId);
  const results: RunResult[] = [];
  const now = Date.now();

  for (const rule of rules) {
    if (rule.trigger_type === "new_lead") {
      const since = new Date(now - 48 * 60 * 60 * 1000).toISOString();
      const query = await supabase.from("website_leads").select("id,created_at,first_name,last_name,company,status,assigned_to").gte("created_at", since).in("status", ["new", "to_contact"]).order("created_at", { ascending: false }).limit(100);
      if (!query.error) for (const lead of query.data ?? []) {
        const payload = { ...lead, lead_id: lead.id, lead: leadLabel(lead as Record<string, unknown>) };
        results.push(await executeRule(supabase, rule, `created:${lead.id}`, "lead", lead.id, payload));
      }
    }

    if (rule.trigger_type === "urgent_ticket") {
      const query = await supabase.from("support_tickets").select("id,subject,requester_name,requester_email,priority,status").eq("priority", "urgent").in("status", ["open", "in_progress", "waiting"]).limit(100);
      if (!query.error) for (const ticket of query.data ?? []) {
        const payload = { ...ticket, ticket_id: ticket.id, requester: ticket.requester_name || ticket.requester_email };
        results.push(await executeRule(supabase, rule, `urgent:${ticket.id}`, "support_ticket", ticket.id, payload));
      }
    }

    if (rule.trigger_type === "appointment_reminder") {
      const conditions = object(rule.conditions);
      const hoursBefore = Math.max(1, Math.min(168, numberValue(conditions.hours_before, 24)));
      const horizon = new Date(now + hoursBefore * 60 * 60 * 1000).toISOString();
      const query = await supabase.from("website_appointments").select("id,lead_id,starts_at,status,provider,website_leads(first_name,last_name,company,assigned_to)").in("status", ["pending", "confirmed"]).gte("starts_at", new Date(now).toISOString()).lte("starts_at", horizon).order("starts_at", { ascending: true }).limit(100);
      if (!query.error) for (const appointment of query.data ?? []) {
        const lead = relation(appointment.website_leads);
        const payload = {
          appointment_id: appointment.id,
          lead_id: appointment.lead_id,
          lead: leadLabel(lead),
          assigned_to: stringValue(lead.assigned_to),
          appointment_time: appointment.starts_at ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(appointment.starts_at)) : "",
        };
        results.push(await executeRule(supabase, rule, `appointment:${appointment.id}:${appointment.starts_at}`, "appointment", appointment.id, payload));
      }
    }

    if (rule.trigger_type === "stale_lead") {
      const conditions = object(rule.conditions);
      const days = Math.max(1, Math.min(90, numberValue(conditions.days_without_contact, 5)));
      const threshold = now - days * 24 * 60 * 60 * 1000;
      const query = await supabase.from("website_leads").select("id,created_at,last_contacted_at,first_name,last_name,company,status,assigned_to").order("created_at", { ascending: false }).limit(400);
      if (!query.error) for (const lead of query.data ?? []) {
        if (["won", "lost"].includes(lead.status)) continue;
        const anchor = lead.last_contacted_at || lead.created_at;
        if (!anchor || new Date(anchor).getTime() > threshold) continue;
        const payload = { ...lead, lead_id: lead.id, lead: leadLabel(lead as Record<string, unknown>) };
        results.push(await executeRule(supabase, rule, `stale:${lead.id}:${anchor}`, "lead", lead.id, payload));
      }
    }
  }

  return results;
}
