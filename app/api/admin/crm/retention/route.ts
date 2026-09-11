import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { syncCustomerSuccessHealth } from "@/lib/crm-customer-success";
import { runRetentionAutomations } from "@/lib/crm-retention-automations";

async function bodyOf(request: Request) { try { return await request.json() as Record<string, unknown>; } catch { return null; } }
function missing(error: any) { return ["42P01", "42703"].includes(String(error?.code || "")); }
function bool(value: unknown, fallback: boolean) { return typeof value === "boolean" ? value : fallback; }
function integer(value: unknown, min: number, max: number, fallback: number) { const n = Number(value); return Number.isInteger(n) && n >= min && n <= max ? n : fallback; }
function actor(session: any) { return session.name || session.email || "MOONY Admin"; }
function relation(value: any) { return Array.isArray(value) ? value[0] ?? null : value ?? null; }

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request, "crm.read");
  if (error || !supabase) return error;
  const [settingsResult, casesResult, runsResult] = await Promise.all([
    supabase.from("website_crm_retention_settings").select("*").eq("id", "default").maybeSingle(),
    supabase.from("website_crm_retention_cases").select("*,website_crm_client_accounts(id,account_name,lead_id,owner,commercial_owner,health_score,health_status,adoption_score,renewal_date,website_leads(first_name,last_name,email,company,country))").order("opened_at", { ascending: false }).limit(300),
    supabase.from("website_crm_retention_runs").select("*,website_crm_client_accounts(id,account_name)").order("executed_at", { ascending: false }).limit(200),
  ]);
  if (settingsResult.error) {
    if (missing(settingsResult.error)) return NextResponse.json({ available: false, settings: null, cases: [], runs: [], metrics: { open: 0, urgent: 0, recovered: 0, runs7d: 0 }, capabilities: { cron: Boolean(process.env.AUTOMATION_CRON_SECRET || process.env.CRON_SECRET) } });
    return NextResponse.json({ error: settingsResult.error.message }, { status: 500 });
  }
  if (casesResult.error && !missing(casesResult.error)) return NextResponse.json({ error: casesResult.error.message }, { status: 500 });
  if (runsResult.error && !missing(runsResult.error)) return NextResponse.json({ error: runsResult.error.message }, { status: 500 });
  const cases = (casesResult.data ?? []).map((row: any) => ({ ...row, website_crm_client_accounts: relation(row.website_crm_client_accounts) }));
  const runs = (runsResult.data ?? []).map((row: any) => ({ ...row, website_crm_client_accounts: relation(row.website_crm_client_accounts) }));
  const weekAgo = Date.now() - 7 * 86400000;
  const metrics = {
    open: cases.filter((row: any) => ["open", "in_progress"].includes(row.status)).length,
    urgent: cases.filter((row: any) => ["open", "in_progress"].includes(row.status) && row.priority === "urgent").length,
    recovered: cases.filter((row: any) => row.status === "recovered").length,
    runs7d: runs.filter((row: any) => new Date(row.executed_at).getTime() >= weekAgo && row.status === "success").length,
  };
  return NextResponse.json({ available: true, settings: settingsResult.data, cases, runs, metrics, capabilities: { cron: Boolean(process.env.AUTOMATION_CRON_SECRET || process.env.CRON_SECRET) } });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write");
  if (error || !supabase || !session) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const current = await supabase.from("website_crm_retention_settings").select("*").eq("id", "default").maybeSingle();
  if (current.error) {
    if (missing(current.error)) return NextResponse.json({ error: "Appliquez la migration CRM V8.1 avant de configurer la rétention." }, { status: 503 });
    return NextResponse.json({ error: current.error.message }, { status: 500 });
  }
  const base = current.data ?? {};
  const day1 = integer(body.renewalDay1, 1, 365, Number(base.renewal_day_1 || 60));
  const day2 = integer(body.renewalDay2, 1, 365, Number(base.renewal_day_2 || 30));
  const day3 = integer(body.renewalDay3, 1, 365, Number(base.renewal_day_3 || 15));
  if (!(day1 > day2 && day2 > day3)) return NextResponse.json({ error: "Les jalons doivent respecter J1 > J2 > J3 (ex. 60, 30, 15)." }, { status: 422 });
  const patch = {
    enabled: bool(body.enabled, Boolean(base.enabled)),
    health_risk_enabled: bool(body.healthRiskEnabled, base.health_risk_enabled !== false),
    nps_detractor_enabled: bool(body.npsDetractorEnabled, base.nps_detractor_enabled !== false),
    renewal_enabled: bool(body.renewalEnabled, base.renewal_enabled !== false),
    expansion_enabled: bool(body.expansionEnabled, base.expansion_enabled !== false),
    expansion_adoption_threshold: integer(body.expansionAdoptionThreshold, 50, 100, Number(base.expansion_adoption_threshold || 85)),
    renewal_day_1: day1,
    renewal_day_2: day2,
    renewal_day_3: day3,
    updated_by: actor(session),
    updated_at: new Date().toISOString(),
  };
  const updated = await supabase.from("website_crm_retention_settings").upsert({ id: "default", ...patch }).select("*").single();
  if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 });
  await writeAuditLog(supabase, session, "crm.retention_settings_updated", "crm_retention_settings", "default", "Paramètres de rétention mis à jour", patch);
  return NextResponse.json({ settings: updated.data });
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write");
  if (error || !supabase || !session) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const action = asText(body.action, 40);

  if (action === "run") {
    try {
      const health = await syncCustomerSuccessHealth(supabase);
      if (!health.available) return NextResponse.json({ error: "CRM V8 doit être disponible avant d’exécuter la rétention." }, { status: 503 });
      const clientId = asText(body.clientId, 80);
      const result = await runRetentionAutomations(supabase, { force: true, clientIds: clientId ? [clientId] : undefined });
      if (!result.available) return NextResponse.json({ error: "Appliquez la migration CRM V8.1 avant d’exécuter les automatisations de rétention." }, { status: 503 });
      await writeAuditLog(supabase, session, "crm.retention_manual_run", "crm_retention", clientId || null, clientId ? "Rétention exécutée manuellement pour un client" : "Rétention exécutée manuellement", result);
      return NextResponse.json({ ok: true, health, retention: result });
    } catch (runError) {
      return NextResponse.json({ error: runError instanceof Error ? runError.message : "Exécution de la rétention impossible." }, { status: 500 });
    }
  }

  if (action === "case_status") {
    const caseId = asText(body.caseId, 80);
    const status = asText(body.status, 30);
    if (!caseId || !["open", "in_progress", "recovered", "closed"].includes(status)) return NextResponse.json({ error: "Cas ou statut invalide." }, { status: 422 });
    const existing = await supabase.from("website_crm_retention_cases").select("id,client_id,title,status").eq("id", caseId).maybeSingle();
    if (existing.error || !existing.data) return NextResponse.json({ error: "Cas de rétention introuvable." }, { status: 404 });
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updated_by: actor(session), updated_at: now };
    if (status === "recovered") patch.recovered_at = now;
    else if (existing.data.status === "recovered") patch.recovered_at = null;
    const updated = await supabase.from("website_crm_retention_cases").update(patch).eq("id", caseId).select("*").single();
    if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 });
    await supabase.from("website_crm_client_success_events").insert({ client_id: existing.data.client_id, event_type: status === "recovered" ? "health" : "risk", title: status === "recovered" ? "Cas de rétention récupéré" : `Cas de rétention · ${status}`, detail: existing.data.title, actor: actor(session) });
    await writeAuditLog(supabase, session, "crm.retention_case_updated", "crm_retention_case", caseId, `${existing.data.title} · ${status}`, { from: existing.data.status, to: status, clientId: existing.data.client_id });
    return NextResponse.json({ case: updated.data });
  }

  return NextResponse.json({ error: "Action non prise en charge." }, { status: 422 });
}
