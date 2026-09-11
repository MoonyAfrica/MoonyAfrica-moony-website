export type CrmPlaybookConditions = {
  statuses?: string[];
  needs?: string[];
  temperatures?: string[];
  min_score?: number;
  max_score?: number;
  min_deal_value?: number;
  stale_min_days?: number;
};

export type CrmPlaybookGuidance = {
  objective?: string;
  next_action?: string;
  due_in_hours?: number;
  task_priority?: "low" | "normal" | "high" | "urgent";
  channel?: "call" | "email" | "whatsapp" | "meeting";
  argument_points?: string[];
  message_template?: string;
};

export type CrmPlaybookRecord = {
  id: string;
  system_key?: string | null;
  name: string;
  description?: string | null;
  active: boolean;
  priority: number;
  conditions: CrmPlaybookConditions | Record<string, unknown> | null;
  guidance: CrmPlaybookGuidance | Record<string, unknown> | null;
};

export type CrmPlaybookLead = Record<string, unknown> & {
  id?: string;
  first_name?: string;
  last_name?: string;
  company?: string | null;
  status?: string;
  need?: string;
  deal_value?: number | null;
  last_contacted_at?: string | null;
  created_at?: string | null;
  score?: number;
  temperature?: string;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function list(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ageDays(value: unknown, now = Date.now()) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(String(value)).getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now - timestamp) / 86400000));
}

export function playbookLeadStaleDays(lead: CrmPlaybookLead, now = Date.now()) {
  return ageDays(lead.last_contacted_at || lead.created_at, now);
}

export function crmPlaybookMatches(playbook: CrmPlaybookRecord, lead: CrmPlaybookLead, now = Date.now()) {
  if (!playbook.active) return false;
  const conditions = object(playbook.conditions);
  const statuses = list(conditions.statuses);
  const needs = list(conditions.needs);
  const temperatures = list(conditions.temperatures);
  const status = String(lead.status ?? "");
  const need = String(lead.need ?? "");
  const temperature = String(lead.temperature ?? "");
  const score = numberValue(lead.score, 0);
  const dealValue = Math.max(0, numberValue(lead.deal_value, 0));

  if (statuses.length && !statuses.includes(status)) return false;
  if (needs.length && !needs.includes(need)) return false;
  if (temperatures.length && !temperatures.includes(temperature)) return false;
  if (conditions.min_score !== undefined && score < numberValue(conditions.min_score, 0)) return false;
  if (conditions.max_score !== undefined && score > numberValue(conditions.max_score, 100)) return false;
  if (conditions.min_deal_value !== undefined && dealValue < numberValue(conditions.min_deal_value, 0)) return false;
  if (conditions.stale_min_days !== undefined && playbookLeadStaleDays(lead, now) < numberValue(conditions.stale_min_days, 0)) return false;
  return true;
}

export function rankCrmPlaybooks(playbooks: CrmPlaybookRecord[], lead: CrmPlaybookLead) {
  return playbooks
    .filter((playbook) => crmPlaybookMatches(playbook, lead))
    .sort((a, b) => {
      const aConditions = object(a.conditions);
      const bConditions = object(b.conditions);
      const specificity = (conditions: Record<string, unknown>) => ["statuses", "needs", "temperatures", "min_score", "max_score", "min_deal_value", "stale_min_days"]
        .reduce((count, key) => conditions[key] === undefined ? count : count + 1, 0);
      return Number(a.priority || 100) - Number(b.priority || 100) || specificity(bConditions) - specificity(aConditions);
    });
}

export function renderCrmPlaybookTemplate(template: unknown, lead: CrmPlaybookLead) {
  if (typeof template !== "string") return "";
  const variables: Record<string, unknown> = {
    first_name: lead.first_name,
    last_name: lead.last_name,
    company: lead.company || "votre organisation",
    need: lead.need || "votre projet",
    status: lead.status,
    deal_value: lead.deal_value,
    score: lead.score,
    temperature: lead.temperature,
  };
  return template.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, key: string) => {
    const value = variables[key];
    return value === null || value === undefined || value === "" ? "" : String(value);
  });
}

export function normalizedCrmPlaybookGuidance(value: unknown): CrmPlaybookGuidance {
  const source = object(value);
  const taskPriority = String(source.task_priority ?? "normal");
  const channel = String(source.channel ?? "email");
  return {
    objective: typeof source.objective === "string" ? source.objective.slice(0, 1200) : "",
    next_action: typeof source.next_action === "string" ? source.next_action.slice(0, 1200) : "",
    due_in_hours: Math.max(0, Math.min(720, numberValue(source.due_in_hours, 24))),
    task_priority: ["low", "normal", "high", "urgent"].includes(taskPriority) ? taskPriority as CrmPlaybookGuidance["task_priority"] : "normal",
    channel: ["call", "email", "whatsapp", "meeting"].includes(channel) ? channel as CrmPlaybookGuidance["channel"] : "email",
    argument_points: list(source.argument_points).slice(0, 8).map((item) => item.slice(0, 500)),
    message_template: typeof source.message_template === "string" ? source.message_template.slice(0, 10000) : "",
  };
}
