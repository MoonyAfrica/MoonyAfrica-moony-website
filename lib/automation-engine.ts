import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { leadMatchesSegmentFilters } from "@/lib/crm-segment-matching";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
type TriggerType = "new_lead" | "urgent_ticket" | "appointment_reminder" | "stale_lead" | "lead_tag_added" | "segment_match";
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
  tag_id?: string;
  tag_ids?: string[];
  segment_ids?: string[];
  __chain_depth?: number;
};

type RunResult = { ruleId: string; ruleName: string; status: "success" | "failed" | "skipped"; sourceId?: string; actions?: number; error?: string };
type ActionResult = { type: string; id?: string; title?: string; scheduledAt?: string; result?: unknown };

const leadStages = new Set(["new", "to_contact", "contacted", "appointment", "proposal", "negotiation", "won", "lost"]);

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

function list(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim().toLowerCase()).filter(Boolean) : [];
}

function rawList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function matchesList(condition: unknown, value: unknown) {
  const expected = list(condition);
  if (!expected.length) return true;
  const actual = String(value ?? "").trim().toLowerCase();
  return Boolean(actual) && expected.includes(actual);
}

function conditionsMatch(rule: AutomationRule, payload: AutomationPayload) {
  const conditions = object(rule.conditions);

  if (!matchesList(conditions.statuses, payload.status)) return false;
  if (!matchesList(conditions.countries, payload.country)) return false;
  if (!matchesList(conditions.needs, payload.need)) return false;
  if (!matchesList(conditions.assignees, payload.assigned_to)) return false;
  if (!matchesList(conditions.sources, payload.source)) return false;
  if (!matchesList(conditions.priorities, payload.priority)) return false;

  const dealValue = Number(payload.deal_value ?? 0);
  if (conditions.min_deal_value !== undefined && dealValue < numberValue(conditions.min_deal_value, 0)) return false;
  if (conditions.max_deal_value !== undefined && dealValue > numberValue(conditions.max_deal_value, Number.MAX_SAFE_INTEGER)) return false;

  const companyContains = stringValue(conditions.company_contains).trim().toLowerCase();
  if (companyContains && !stringValue(payload.company).toLowerCase().includes(companyContains)) return false;

  const requiredTags = rawList(conditions.tag_ids);
  if (rule.trigger_type === "lead_tag_added" && !requiredTags.length) return false;
  if (requiredTags.length) {
    const ownedTags = rawList(payload.tag_ids);
    const eventTag = stringValue(payload.tag_id);
    const matched = rule.trigger_type === "lead_tag_added"
      ? requiredTags.includes(eventTag)
      : requiredTags.every((tagId) => ownedTags.includes(tagId));
    if (!matched) return false;
  }

  const requiredSegments = rawList(conditions.segment_ids);
  if (rule.trigger_type === "segment_match" && !requiredSegments.length) return false;
  if (requiredSegments.length) {
    const matchedSegments = rawList(payload.segment_ids);
    if (!requiredSegments.some((segmentId) => matchedSegments.includes(segmentId))) return false;
  }

  return true;
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

async function sendEmail(action: Record<string, unknown>, payload: AutomationPayload) {
  const apiKey = process.env.BREVO_API_KEY ?? "";
  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? "";
  if (!apiKey || !senderEmail) throw new Error("Brevo n’est pas configuré pour les e-mails automatiques.");

  const to = render(action.to || "{{email}}", payload).trim().toLowerCase();
  if (!to || !to.includes("@")) throw new Error("L’automatisation ne dispose pas d’une adresse e-mail destinataire valide.");
  const subject = render(action.subject || "Message de MOONY", payload).slice(0, 180) || "Message de MOONY";
  const text = render(action.body || "", payload).slice(0, 10000);
  const senderName = process.env.BREVO_SENDER_NAME ?? "MOONY Africa";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent: `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#4b2b21">${htmlEscape(text).replace(/\n/g, "<br>")}</div>`,
      textContent: text,
    }),
  });
  if (!response.ok) throw new Error(`Brevo a refusé l’envoi automatique (${response.status}).`);
  const result = await response.json().catch(() => ({}));
  return { to, subject, providerMessageId: object(result).messageId ?? null };
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
    // The automation remains functional if the audit table is temporarily unavailable.
  }
}

async function queueAction(supabase: SupabaseAdmin, rule: AutomationRule, runId: string, sourceType: string, sourceId: string, payload: AutomationPayload, action: Record<string, unknown>, delayHours: number): Promise<ActionResult> {
  const scheduledAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();
  const queuedAction = { ...action, delay_hours: 0 };
  const result = await supabase.from("control_center_automation_jobs").insert({
    rule_id: rule.id,
    run_id: runId,
    source_type: sourceType,
    source_id: sourceId,
    action: queuedAction,
    payload,
    scheduled_at: scheduledAt,
    status: "pending",
  }).select("id").single();
  if (result.error) throw new Error(result.error.message);
  return { type: stringValue(action.type), id: result.data.id, scheduledAt };
}

async function performAction(supabase: SupabaseAdmin, rule: AutomationRule, runId: string | null, sourceType: string, sourceId: string, payload: AutomationPayload, action: Record<string, unknown>): Promise<ActionResult | null> {
  const type = stringValue(action.type);

  if (type === "create_crm_task") {
    const leadId = stringValue(payload.lead_id);
    if (!leadId) return null;
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
      assigned_to: render(action.assigned_to || "{{assigned_to}}", payload) || null,
      notes: render(action.notes, payload) || `Créée automatiquement par « ${rule.name} »`,
      metadata: { automation_rule_id: rule.id, automation_run_id: runId },
    }).select("id").single();
    if (task.error) throw new Error(task.error.message);
    return { type, id: task.data.id, title, result: { dueAt } };
  }

  if (type === "notify_role") {
    const title = render(action.title, payload) || rule.name;
    const subtitle = render(action.subtitle, payload) || null;
    const href = render(action.href, payload) || "/admin/activite";
    const severity = ["info", "warning", "urgent"].includes(stringValue(action.severity)) ? stringValue(action.severity) : "info";
    const notification = await supabase.from("control_center_generated_notifications").insert({
      automation_rule_id: rule.id,
      target_role: stringValue(action.role) || null,
      target_user_key: render(action.user_key, payload) || null,
      title,
      subtitle,
      href,
      severity,
      source_type: sourceType,
      source_id: sourceId,
      expires_at: new Date(Date.now() + Math.max(24, numberValue(action.expires_in_hours, 168)) * 60 * 60 * 1000).toISOString(),
    }).select("id").single();
    if (notification.error) throw new Error(notification.error.message);
    return { type, id: notification.data.id, title };
  }

  if (type === "send_email") {
    const result = await sendEmail(action, payload);
    return { type, title: String(result.subject), result };
  }

  if (type === "update_lead_stage") {
    const leadId = stringValue(payload.lead_id);
    const status = stringValue(action.status);
    if (!leadId || !leadStages.has(status)) return null;
    const result = await supabase.from("website_leads").update({ status, updated_at: new Date().toISOString() }).eq("id", leadId).select("id").maybeSingle();
    if (result.error) throw new Error(result.error.message);
    await supabase.from("website_crm_activities").insert({ lead_id: leadId, kind: "system", summary: `Étape mise à jour automatiquement : ${status}`, created_by: "Automatisation MOONY" });
    return { type, id: leadId, result: { status } };
  }

  if (type === "add_crm_note") {
    const leadId = stringValue(payload.lead_id);
    if (!leadId) return null;
    const summary = render(action.summary || rule.name, payload) || rule.name;
    const body = render(action.body, payload) || null;
    const result = await supabase.from("website_crm_activities").insert({ lead_id: leadId, kind: "note", summary, body, created_by: "Automatisation MOONY" }).select("id").single();
    if (result.error) throw new Error(result.error.message);
    return { type, id: result.data.id, title: summary };
  }

  if (type === "run_rule") {
    const targetRuleId = stringValue(action.rule_id);
    const depth = Number(payload.__chain_depth ?? 0);
    if (!targetRuleId) return null;
    if (depth >= 4) throw new Error("La chaîne d’automatisations dépasse la profondeur maximale autorisée.");
    const target = await supabase.from("control_center_automation_rules").select("id,name,trigger_type,enabled,conditions,actions").eq("id", targetRuleId).eq("enabled", true).maybeSingle();
    if (target.error) throw new Error(target.error.message);
    if (!target.data) throw new Error("L’automatisation suivante est introuvable ou désactivée.");
    const chainedPayload = { ...payload, __chain_depth: depth + 1 };
    const result = await executeRule(supabase, target.data as AutomationRule, `chain:${rule.id}:${sourceId}:${targetRuleId}:${depth + 1}`, sourceType, sourceId, chainedPayload, true);
    if (result.status === "failed") throw new Error(result.error || "L’automatisation suivante a échoué.");
    return { type, id: targetRuleId, title: target.data.name, result };
  }

  return null;
}

async function executeRule(supabase: SupabaseAdmin, rule: AutomationRule, eventKey: string, sourceType: string, sourceId: string, payload: AutomationPayload, skipConditions = false): Promise<RunResult> {
  if (!skipConditions && !conditionsMatch(rule, payload)) return { ruleId: rule.id, ruleName: rule.name, status: "skipped", sourceId };

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
  const details: ActionResult[] = [];

  try {
    for (const rawAction of actions.slice(0, 20)) {
      const action = object(rawAction);
      const delayHours = Math.max(0, Math.min(24 * 30, numberValue(action.delay_hours, 0)));
      let detail: ActionResult | null = null;
      if (delayHours > 0) detail = await queueAction(supabase, rule, runId, sourceType, sourceId, payload, action, delayHours);
      else detail = await performAction(supabase, rule, runId, sourceType, sourceId, payload, action);
      if (detail) { executed += 1; details.push(detail); }
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

export async function triggerAutomationEvent(supabase: SupabaseAdmin, triggerType: Extract<TriggerType, "new_lead" | "urgent_ticket" | "lead_tag_added">, sourceType: string, sourceId: string, payload: AutomationPayload) {
  let rules: AutomationRule[] = [];
  try { rules = await enabledRules(supabase, [triggerType]); } catch { return [] as RunResult[]; }
  const eventKey = triggerType === "urgent_ticket"
    ? `urgent:${sourceId}`
    : triggerType === "lead_tag_added"
      ? `tag-added:${sourceId}:${stringValue(payload.tag_id)}`
      : `created:${sourceId}`;
  return Promise.all(rules.map((rule) => executeRule(supabase, rule, eventKey, sourceType, sourceId, payload)));
}

export async function triggerLeadTagAddedAutomationEvents(supabase: SupabaseAdmin, leadIds: string[], tagId: string) {
  const uniqueIds = [...new Set(leadIds.map((id) => id.trim()).filter(Boolean))].slice(0, 200);
  if (!uniqueIds.length || !tagId) return [] as RunResult[];

  let rules: AutomationRule[] = [];
  try { rules = await enabledRules(supabase, ["lead_tag_added"]); } catch { return [] as RunResult[]; }
  if (!rules.length) return [] as RunResult[];

  const query = await supabase.from("website_leads").select("id,first_name,last_name,company,email,status,assigned_to,country,need,source,deal_value").in("id", uniqueIds);
  if (query.error) return [] as RunResult[];

  const results: RunResult[] = [];
  for (const lead of query.data ?? []) {
    const payload: AutomationPayload = {
      ...lead,
      lead_id: lead.id,
      lead: leadLabel(lead as Record<string, unknown>),
      tag_id: tagId,
      tag_ids: [tagId],
    };
    for (const rule of rules) results.push(await executeRule(supabase, rule, `tag-added:${lead.id}:${tagId}`, "lead", lead.id, payload));
  }
  return results;
}

async function segmentPayloads(supabase: SupabaseAdmin, segmentIds: string[]) {
  if (!segmentIds.length) return [] as Array<{ lead: Record<string, unknown>; segmentIds: string[]; tagIds: string[] }>;

  const [segmentResult, leadResult] = await Promise.all([
    supabase.from("website_crm_segments").select("id,filters").in("id", segmentIds),
    supabase.from("website_leads").select("id,created_at,last_contacted_at,first_name,last_name,email,phone,company,country,city,status,assigned_to,need,source,deal_value").order("updated_at", { ascending: false }).limit(500),
  ]);
  if (segmentResult.error || leadResult.error) return [];

  const leads = (leadResult.data ?? []) as Array<Record<string, unknown>>;
  const leadIds = leads.map((lead) => String(lead.id));
  const tagsByLead = new Map<string, string[]>();
  if (leadIds.length) {
    const tagResult = await supabase.from("website_crm_lead_tags").select("lead_id,tag_id").in("lead_id", leadIds);
    if (!tagResult.error) {
      for (const relation of tagResult.data ?? []) {
        const key = String(relation.lead_id);
        tagsByLead.set(key, [...(tagsByLead.get(key) ?? []), String(relation.tag_id)]);
      }
    }
  }

  const segments = (segmentResult.data ?? []) as Array<{ id: string; filters: unknown }>;
  return leads.map((lead) => {
    const tagIds = tagsByLead.get(String(lead.id)) ?? [];
    const matched = segments.filter((segment) => leadMatchesSegmentFilters(lead, segment.filters, tagIds)).map((segment) => segment.id);
    return { lead, segmentIds: matched, tagIds };
  }).filter((item) => item.segmentIds.length > 0);
}

export async function runScheduledAutomations(supabase: SupabaseAdmin, ruleId?: string) {
  const rules = await enabledRules(supabase, undefined, ruleId);
  const results: RunResult[] = [];
  const now = Date.now();

  for (const rule of rules) {
    if (rule.trigger_type === "new_lead") {
      const since = new Date(now - 48 * 60 * 60 * 1000).toISOString();
      const query = await supabase.from("website_leads").select("id,created_at,first_name,last_name,company,email,status,assigned_to,country,need,source,deal_value").gte("created_at", since).in("status", ["new", "to_contact"]).order("created_at", { ascending: false }).limit(100);
      if (!query.error) for (const lead of query.data ?? []) {
        const payload = { ...lead, lead_id: lead.id, lead: leadLabel(lead as Record<string, unknown>) };
        results.push(await executeRule(supabase, rule, `created:${lead.id}`, "lead", lead.id, payload));
      }
    }

    if (rule.trigger_type === "urgent_ticket") {
      const query = await supabase.from("support_tickets").select("id,subject,requester_name,requester_email,priority,status,type").eq("priority", "urgent").in("status", ["open", "in_progress", "waiting"]).limit(100);
      if (!query.error) for (const ticket of query.data ?? []) {
        const payload = { ...ticket, ticket_id: ticket.id, requester: ticket.requester_name || ticket.requester_email, email: ticket.requester_email };
        results.push(await executeRule(supabase, rule, `urgent:${ticket.id}`, "support_ticket", ticket.id, payload));
      }
    }

    if (rule.trigger_type === "appointment_reminder") {
      const conditions = object(rule.conditions);
      const hoursBefore = Math.max(1, Math.min(168, numberValue(conditions.hours_before, 24)));
      const horizon = new Date(now + hoursBefore * 60 * 60 * 1000).toISOString();
      const query = await supabase.from("website_appointments").select("id,lead_id,starts_at,status,provider,website_leads(first_name,last_name,company,email,assigned_to,country,need,deal_value)").in("status", ["pending", "confirmed"]).gte("starts_at", new Date(now).toISOString()).lte("starts_at", horizon).order("starts_at", { ascending: true }).limit(100);
      if (!query.error) for (const appointment of query.data ?? []) {
        const lead = relation(appointment.website_leads);
        const payload = {
          appointment_id: appointment.id,
          lead_id: appointment.lead_id,
          lead: leadLabel(lead),
          first_name: lead.first_name,
          last_name: lead.last_name,
          company: lead.company,
          email: lead.email,
          assigned_to: lead.assigned_to,
          country: lead.country,
          need: lead.need,
          deal_value: lead.deal_value,
          status: appointment.status,
          appointment_time: appointment.starts_at ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(appointment.starts_at)) : "",
        };
        results.push(await executeRule(supabase, rule, `appointment:${appointment.id}:${appointment.starts_at}`, "appointment", appointment.id, payload));
      }
    }

    if (rule.trigger_type === "stale_lead") {
      const conditions = object(rule.conditions);
      const days = Math.max(1, Math.min(90, numberValue(conditions.days_without_contact, 5)));
      const threshold = now - days * 24 * 60 * 60 * 1000;
      const query = await supabase.from("website_leads").select("id,created_at,last_contacted_at,first_name,last_name,company,email,status,assigned_to,country,need,source,deal_value").order("created_at", { ascending: false }).limit(400);
      if (!query.error) for (const lead of query.data ?? []) {
        if (["won", "lost"].includes(lead.status)) continue;
        const anchor = lead.last_contacted_at || lead.created_at;
        if (!anchor || new Date(anchor).getTime() > threshold) continue;
        const payload = { ...lead, lead_id: lead.id, lead: leadLabel(lead as Record<string, unknown>) };
        results.push(await executeRule(supabase, rule, `stale:${lead.id}:${anchor}`, "lead", lead.id, payload));
      }
    }

    if (rule.trigger_type === "segment_match") {
      const requestedSegments = rawList(object(rule.conditions).segment_ids);
      if (!requestedSegments.length) continue;
      const matches = await segmentPayloads(supabase, requestedSegments);
      for (const match of matches) {
        const leadId = String(match.lead.id);
        const payload: AutomationPayload = {
          ...match.lead,
          lead_id: leadId,
          lead: leadLabel(match.lead),
          tag_ids: match.tagIds,
          segment_ids: match.segmentIds,
        };
        results.push(await executeRule(supabase, rule, `segment-match:${leadId}`, "lead", leadId, payload));
      }
    }
  }

  return results;
}

export async function runDueAutomationJobs(supabase: SupabaseAdmin) {
  const due = await supabase.from("control_center_automation_jobs").select("id,rule_id,run_id,source_type,source_id,action,payload,scheduled_at,status,attempts").eq("status", "pending").lte("scheduled_at", new Date().toISOString()).order("scheduled_at", { ascending: true }).limit(100);
  if (due.error) {
    if (due.error.code === "42P01") return [] as RunResult[];
    throw new Error(due.error.message);
  }

  const results: RunResult[] = [];
  for (const job of due.data ?? []) {
    const lock = await supabase.from("control_center_automation_jobs").update({ status: "running", started_at: new Date().toISOString(), attempts: Number(job.attempts || 0) + 1 }).eq("id", job.id).eq("status", "pending").select("id").maybeSingle();
    if (lock.error || !lock.data) continue;

    const ruleQuery = await supabase.from("control_center_automation_rules").select("id,name,trigger_type,enabled,conditions,actions").eq("id", job.rule_id).maybeSingle();
    if (ruleQuery.error || !ruleQuery.data) {
      const message = ruleQuery.error?.message || "Règle introuvable";
      await supabase.from("control_center_automation_jobs").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", job.id);
      results.push({ ruleId: String(job.rule_id || ""), ruleName: "Automatisation", status: "failed", sourceId: String(job.source_id || ""), error: message });
      continue;
    }

    try {
      const detail = await performAction(supabase, ruleQuery.data as AutomationRule, job.run_id || null, String(job.source_type || "automation"), String(job.source_id || job.id), object(job.payload) as AutomationPayload, object(job.action));
      await supabase.from("control_center_automation_jobs").update({ status: "success", result: detail ?? {}, completed_at: new Date().toISOString() }).eq("id", job.id);
      results.push({ ruleId: ruleQuery.data.id, ruleName: ruleQuery.data.name, status: "success", sourceId: String(job.source_id || ""), actions: detail ? 1 : 0 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action différée en échec";
      await supabase.from("control_center_automation_jobs").update({ status: "failed", error: message.slice(0, 1000), completed_at: new Date().toISOString() }).eq("id", job.id);
      results.push({ ruleId: ruleQuery.data.id, ruleName: ruleQuery.data.name, status: "failed", sourceId: String(job.source_id || ""), error: message });
    }
  }
  return results;
}
