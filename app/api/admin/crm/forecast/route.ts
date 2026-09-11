import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";

const stages = ["new","to_contact","contacted","appointment","proposal","negotiation","won","lost"] as const;
const defaultProbabilities: Record<string, number> = {
  new: 0.05,
  to_contact: 0.10,
  contacted: 0.20,
  appointment: 0.35,
  proposal: 0.55,
  negotiation: 0.75,
  won: 1,
  lost: 0,
};
const labels: Record<string,string> = {
  new:"Nouveau",to_contact:"À contacter",contacted:"Contacté",appointment:"RDV planifié",
  proposal:"Proposition envoyée",negotiation:"Négociation",won:"Signé",lost:"Perdu",
};

async function bodyOf(request: Request) {
  try { return await request.json() as Record<string, unknown>; } catch { return null; }
}

function probability(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function cleanProbabilities(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
  return Object.fromEntries(stages.map((stage) => [stage, stage === "won" ? 1 : stage === "lost" ? 0 : probability(source[stage], defaultProbabilities[stage])]));
}

function moneyValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function daysSince(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request, "crm.read");
  if (error || !supabase) return error;

  const [leadsResult, tasksResult, settingsResult] = await Promise.all([
    supabase.from("website_leads").select("id,first_name,last_name,company,status,deal_value,country,assigned_to,created_at,updated_at,last_contacted_at").order("updated_at", { ascending: false }).limit(1000),
    supabase.from("website_crm_tasks").select("id,lead_id,title,due_at,status,priority,assigned_to").in("status", ["todo","in_progress"]).order("due_at", { ascending: true, nullsFirst: false }).limit(500),
    supabase.from("website_crm_forecast_settings").select("stage_probabilities,monthly_target,currency,stale_after_days,updated_at").eq("id", "default").maybeSingle(),
  ]);

  if (leadsResult.error) return NextResponse.json({ error: leadsResult.error.message }, { status: 500 });
  const settingsAvailable = !settingsResult.error;
  const probabilities = cleanProbabilities(settingsResult.data?.stage_probabilities ?? defaultProbabilities);
  const monthlyTarget = settingsAvailable && settingsResult.data?.monthly_target != null ? moneyValue(settingsResult.data.monthly_target) : null;
  const currency = settingsAvailable ? String(settingsResult.data?.currency || "EUR") : "EUR";
  const staleAfterDays = settingsAvailable ? Math.max(1, Math.min(90, Number(settingsResult.data?.stale_after_days || 7))) : 7;
  const leads = leadsResult.data ?? [];
  const tasks = tasksResult.error ? [] : (tasksResult.data ?? []);
  const openStatuses = new Set(["new","to_contact","contacted","appointment","proposal","negotiation"]);

  const stageRows = stages.map((stage) => {
    const rows = leads.filter((lead) => lead.status === stage);
    const value = rows.reduce((sum,lead) => sum + moneyValue(lead.deal_value), 0);
    const weighted = value * probabilities[stage];
    return { stage, label: labels[stage], count: rows.length, value, probability: probabilities[stage], weighted };
  });

  const openLeads = leads.filter((lead) => openStatuses.has(String(lead.status)));
  const pipelineValue = openLeads.reduce((sum,lead) => sum + moneyValue(lead.deal_value), 0);
  const weightedForecast = openLeads.reduce((sum,lead) => sum + moneyValue(lead.deal_value) * (probabilities[String(lead.status)] ?? 0), 0);
  const wonValue = leads.filter((lead) => lead.status === "won").reduce((sum,lead) => sum + moneyValue(lead.deal_value), 0);
  const closedCount = leads.filter((lead) => lead.status === "won" || lead.status === "lost").length;
  const wonCount = leads.filter((lead) => lead.status === "won").length;
  const winRate = closedCount ? Math.round((wonCount / closedCount) * 1000) / 10 : 0;

  const taskByLead = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const key = String(task.lead_id || "");
    if (!key) continue;
    taskByLead.set(key, [...(taskByLead.get(key) ?? []), task]);
  }
  const now = Date.now();
  const atRisk = openLeads.map((lead) => {
    const leadTasks = taskByLead.get(String(lead.id)) ?? [];
    const overdue = leadTasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < now).length;
    const anchor = lead.last_contacted_at || lead.created_at;
    const staleDays = daysSince(anchor);
    const reasons:string[] = [];
    if (staleDays >= staleAfterDays) reasons.push(`${staleDays} j sans contact`);
    if (overdue) reasons.push(`${overdue} relance${overdue > 1 ? "s" : ""} en retard`);
    return {
      id: lead.id,
      name: lead.company || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "Prospect",
      contact: `${lead.first_name || ""} ${lead.last_name || ""}`.trim(),
      status: lead.status,
      stageLabel: labels[String(lead.status)] || lead.status,
      dealValue: moneyValue(lead.deal_value),
      weightedValue: moneyValue(lead.deal_value) * (probabilities[String(lead.status)] ?? 0),
      assignedTo: lead.assigned_to,
      country: lead.country,
      staleDays,
      overdueTasks: overdue,
      reasons,
    };
  }).filter((lead) => lead.reasons.length).sort((a,b) => b.dealValue - a.dealValue).slice(0, 30);

  const overdueTasks = tasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < now).length;
  const topDeals = [...openLeads].sort((a,b) => moneyValue(b.deal_value) - moneyValue(a.deal_value)).slice(0,10).map((lead) => ({
    id: lead.id,
    name: lead.company || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "Prospect",
    stage: lead.status,
    stageLabel: labels[String(lead.status)] || lead.status,
    dealValue: moneyValue(lead.deal_value),
    weightedValue: moneyValue(lead.deal_value) * (probabilities[String(lead.status)] ?? 0),
    assignedTo: lead.assigned_to,
  }));

  return NextResponse.json({
    settings: { probabilities, monthlyTarget, currency, staleAfterDays, settingsAvailable },
    metrics: {
      leads: leads.length,
      openDeals: openLeads.length,
      pipelineValue,
      weightedForecast,
      wonValue,
      winRate,
      overdueTasks,
      atRiskDeals: atRisk.length,
      targetCoverage: monthlyTarget && monthlyTarget > 0 ? Math.round((weightedForecast / monthlyTarget) * 1000) / 10 : null,
    },
    stages: stageRows,
    atRisk,
    topDeals,
  });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write");
  if (error || !supabase) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const probabilities = cleanProbabilities(body.probabilities);
  const monthlyTarget = body.monthlyTarget === null || body.monthlyTarget === "" ? null : moneyValue(body.monthlyTarget);
  const currencyInput = asText(body.currency, 3).toUpperCase();
  const currency = /^[A-Z]{3}$/.test(currencyInput) ? currencyInput : "EUR";
  const staleAfterDays = Math.max(1, Math.min(90, Math.round(Number(body.staleAfterDays) || 7)));

  const { data, error: upsertError } = await supabase.from("website_crm_forecast_settings").upsert({
    id: "default",
    stage_probabilities: probabilities,
    monthly_target: monthlyTarget,
    currency,
    stale_after_days: staleAfterDays,
    updated_by: session?.name || session?.email || "MOONY Admin",
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" }).select("*").single();

  if (upsertError) {
    if (upsertError.code === "42P01") return NextResponse.json({ error: "Appliquez la migration CRM Forecast pour enregistrer ces paramètres." }, { status: 409 });
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }
  await writeAuditLog(supabase, session, "crm.forecast_settings_updated", "crm_forecast", "default", "Paramètres de prévision commerciale modifiés", { monthlyTarget, currency, staleAfterDays, probabilities });
  return NextResponse.json({ settings: data });
}
