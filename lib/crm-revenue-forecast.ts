const DAY = 86400000;

export type RevenueForecastSettings = {
  enabled: boolean;
  attention_days: number;
  stale_after_days: number;
};

function missing(error: any) {
  return ["42P01", "42703"].includes(String(error?.code || ""));
}

function relation(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function daysUntil(value: string | null | undefined, now = Date.now()) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - now) / DAY);
}

function daysSince(value: string | null | undefined, now = Date.now()) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((now - time) / DAY);
}

function weekKey(now = new Date()) {
  const date = new Date(now);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

export function revenueForecastSignals(row: any, settings: RevenueForecastSettings, now = Date.now()) {
  const account = relation(row.website_crm_client_accounts) || {};
  const closeDate = row.expected_close_date || row.due_date || null;
  const remaining = daysUntil(closeDate, now);
  const staleDays = daysSince(row.last_forecast_at || row.created_at, now);
  const reasons: string[] = [];

  if (!row.owner) reasons.push("Responsable forecast non assigné");
  if (row.forecast_probability == null) reasons.push("Probabilité non validée");
  if (!String(row.next_step || "").trim()) reasons.push("Prochaine étape absente");

  if (remaining != null && remaining < 0) reasons.push(`Échéance dépassée de ${Math.abs(remaining)} j`);
  else if (row.kind === "renewal" && remaining != null && remaining <= settings.attention_days) reasons.push(`Renouvellement dans ${Math.max(0, remaining)} j`);

  if (staleDays != null && staleDays >= settings.stale_after_days) reasons.push(`Forecast non revu depuis ${staleDays} j`);

  const relationshipRisk = ["at_risk", "critical"].includes(account.health_status) || ["at_risk", "critical"].includes(account.governance_status);
  if (row.forecast_category === "commit" && relationshipRisk) reasons.push("Commit avec risque client actif");

  const urgent = (remaining != null && remaining < 0) || (row.forecast_category === "commit" && (account.health_status === "critical" || account.governance_status === "critical"));
  const attention = urgent || (row.kind === "renewal" && remaining != null && remaining <= settings.attention_days && reasons.length > 1) || (staleDays != null && staleDays >= settings.stale_after_days) || reasons.includes("Commit avec risque client actif");

  return { reasons, urgent, attention, remaining, staleDays, closeDate, account };
}

async function notifyOnce(supabase: any, sourceId: string, title: string, subtitle: string, severity: "info" | "warning" | "urgent", href: string) {
  const existing = await supabase.from("control_center_generated_notifications").select("id").eq("source_type", "crm_revenue_forecast").eq("source_id", sourceId).limit(1);
  if (!existing.error && existing.data?.length) return 0;

  let count = 0;
  for (const targetRole of ["founder", "admin", "sales"]) {
    const inserted = await supabase.from("control_center_generated_notifications").insert({
      target_role: targetRole,
      title,
      subtitle,
      href,
      severity,
      source_type: "crm_revenue_forecast",
      source_id: sourceId,
    });
    if (!inserted.error) count += 1;
  }
  return count;
}

export async function syncRevenueForecastAlerts(supabase: any, options: { force?: boolean } = {}) {
  const result = { available: true, enabled: false, checked: 0, attention: 0, alerts: 0, errors: [] as string[] };
  const settingsResult = await supabase.from("website_crm_revenue_forecast_settings").select("enabled,attention_days,stale_after_days").eq("id", "default").maybeSingle();
  if (settingsResult.error) {
    if (missing(settingsResult.error)) return { ...result, available: false };
    throw new Error(settingsResult.error.message);
  }

  const settings: RevenueForecastSettings = {
    enabled: Boolean(settingsResult.data?.enabled),
    attention_days: Number(settingsResult.data?.attention_days || 45),
    stale_after_days: Number(settingsResult.data?.stale_after_days || 14),
  };
  result.enabled = settings.enabled;
  if (!settings.enabled && !options.force) return result;

  const rowsResult = await supabase.from("website_crm_client_growth_opportunities").select("id,client_id,kind,status,title,estimated_value,currency,due_date,owner,forecast_category,forecast_probability,next_step,expected_close_date,last_forecast_at,created_at,website_crm_client_accounts(account_name,owner,commercial_owner,health_status,governance_status,renewal_date)").in("status", ["open", "planned"]).limit(2000);
  if (rowsResult.error) {
    if (missing(rowsResult.error)) return { ...result, available: false };
    throw new Error(rowsResult.error.message);
  }

  const week = weekKey();
  for (const row of rowsResult.data ?? []) {
    result.checked += 1;
    const signal = revenueForecastSignals(row, settings);
    if (!signal.attention) continue;
    result.attention += 1;

    try {
      const accountName = signal.account?.account_name || "Compte client";
      const kind = row.kind === "renewal" ? "Renouvellement" : row.kind === "upsell" ? "Upsell" : "Cross-sell";
      const title = signal.urgent ? `${kind} à sécuriser en priorité` : "Forecast Customer Success à revoir";
      const subtitle = `${accountName} · ${row.title} · ${signal.reasons.slice(0, 3).join(" · ")}`;
      result.alerts += await notifyOnce(supabase, `growth:${row.id}:${week}`, title, subtitle, signal.urgent ? "urgent" : "warning", `/admin/customer-success/revenue?growth=${row.id}`);
    } catch (error) {
      result.errors.push(`${row.title}: ${error instanceof Error ? error.message : "Erreur d’alerte forecast"}`);
    }
  }

  return result;
}
