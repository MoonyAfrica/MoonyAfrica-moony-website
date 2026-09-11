import { loadCustomerSuccessData } from "@/lib/crm-customer-success";

type RetentionSettings = {
  id: string;
  enabled: boolean;
  health_risk_enabled: boolean;
  nps_detractor_enabled: boolean;
  renewal_enabled: boolean;
  expansion_enabled: boolean;
  expansion_adoption_threshold: number;
  renewal_day_1: number;
  renewal_day_2: number;
  renewal_day_3: number;
};

type RunOptions = { force?: boolean; clientIds?: string[] };
type TriggerType = "health_risk" | "nps_detractor" | "renewal" | "expansion";

type RetentionResult = {
  available: boolean;
  enabled: boolean;
  processed: number;
  createdCases: number;
  createdTasks: number;
  createdGrowth: number;
  alerts: number;
  runs: number;
  recoveredCases: number;
  errors: string[];
};

function missing(error: any) { return ["42P01", "42703"].includes(String(error?.code || "")); }
function relation<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function addHours(hours: number) { return new Date(Date.now() + hours * 3600000).toISOString(); }
function addDays(days: number) { return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10); }
function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(`${value}T23:59:59`).getTime();
  if (Number.isNaN(time)) return null;
  return Math.ceil((time - Date.now()) / 86400000);
}
function quarterKey(now = new Date()) { return `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`; }
function isRisk(status: string | null | undefined) { return status === "at_risk" || status === "critical"; }
function accountName(account: any) { return String(account.account_name || "Client MOONY"); }
function ownerOf(account: any) { return account.owner || account.commercial_owner || "Customer Success"; }

async function notify(supabase: any, clientId: string, key: string, title: string, subtitle: string, severity: "info" | "warning" | "urgent") {
  let count = 0;
  for (const role of ["founder", "admin", "sales"]) {
    const result = await supabase.from("control_center_generated_notifications").insert({
      target_role: role,
      title,
      subtitle,
      href: `/admin/customer-success/retention?client=${clientId}`,
      severity,
      source_type: "crm_retention",
      source_id: `${clientId}:${key}`,
    });
    if (!result.error) count += 1;
  }
  return count;
}

async function successEvent(supabase: any, clientId: string, eventType: "risk" | "health" | "renewal" | "expansion", title: string, detail: string | null) {
  await supabase.from("website_crm_client_success_events").insert({
    client_id: clientId,
    event_type: eventType,
    title,
    detail,
    actor: "MOONY Retention",
  });
}

async function beginRun(supabase: any, clientId: string, triggerType: TriggerType, triggerKey: string, summary: string) {
  const result = await supabase.from("website_crm_retention_runs").insert({
    client_id: clientId,
    trigger_type: triggerType,
    trigger_key: triggerKey,
    status: "partial",
    summary,
    actions: [],
  }).select("id").single();
  if (result.error) {
    if (result.error.code === "23505") return null;
    throw new Error(result.error.message);
  }
  return String(result.data.id);
}

async function finishRun(supabase: any, runId: string, status: "success" | "partial" | "failed" | "skipped", summary: string, actions: unknown[]) {
  await supabase.from("website_crm_retention_runs").update({ status, summary, actions, executed_at: new Date().toISOString() }).eq("id", runId);
}

async function createTasks(supabase: any, account: any, triggerKey: string, tasks: Array<{ title: string; hours: number; priority: "normal" | "high" | "urgent"; notes: string }>) {
  const rows = tasks.map((task) => ({
    lead_id: account.lead_id,
    title: task.title,
    due_at: addHours(task.hours),
    status: "todo",
    priority: task.priority,
    assigned_to: ownerOf(account),
    notes: task.notes,
    metadata: { source: "crm-retention", client_id: account.id, trigger_key: triggerKey },
  }));
  const result = await supabase.from("website_crm_tasks").insert(rows).select("id,title,due_at,priority");
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

async function createCase(supabase: any, account: any, triggerType: "health_risk" | "nps_detractor", triggerKey: string, title: string, priority: "high" | "urgent", snapshot: Record<string, unknown>) {
  const result = await supabase.from("website_crm_retention_cases").insert({
    client_id: account.id,
    trigger_type: triggerType,
    trigger_key: triggerKey,
    title,
    status: "open",
    priority,
    owner: ownerOf(account),
    due_at: addHours(4),
    trigger_snapshot: snapshot,
    created_by: "MOONY Retention",
    updated_by: "MOONY Retention",
  }).select("id").single();
  if (result.error) {
    if (result.error.code === "23505") return null;
    throw new Error(result.error.message);
  }
  return String(result.data.id);
}

async function handleHealthTransition(supabase: any, account: any, result: RetentionResult) {
  const current = String(account.health?.status || account.health_status || "watch");
  const previous = account.retention_last_health_status ? String(account.retention_last_health_status) : null;
  if (isRisk(current) && !isRisk(previous)) {
    const episode = String(account.health_updated_at || new Date().toISOString());
    const triggerKey = `health-risk:${current}:${episode}`;
    const runId = await beginRun(supabase, account.id, "health_risk", triggerKey, `Entrée en risque · ${current}`);
    if (runId) {
      const actions: unknown[] = [];
      try {
        const priority = current === "critical" ? "urgent" : "high";
        const caseId = await createCase(supabase, account, "health_risk", triggerKey, `Plan anti-churn · ${accountName(account)}`, priority, {
          healthStatus: current,
          healthScore: account.health?.score,
          reasons: account.health?.reasons ?? [],
        });
        if (caseId) { result.createdCases += 1; actions.push({ type: "case", id: caseId }); }
        const tasks = await createTasks(supabase, account, triggerKey, [
          { title: `Contacter ${accountName(account)} — signal de risque`, hours: 4, priority, notes: "Prendre contact humainement, écouter le contexte et confirmer les irritants prioritaires. Aucun message client n’est envoyé automatiquement." },
          { title: `Diagnostic Customer Success — ${accountName(account)}`, hours: 24, priority: "high", notes: "Revoir adoption, tickets support, attentes, parties prenantes et résultats attendus. Documenter les causes explicites du risque." },
          { title: `Plan de récupération — ${accountName(account)}`, hours: 72, priority: "high", notes: "Formaliser avec l’équipe un plan d’actions daté, un responsable et un prochain point de contrôle." },
        ]);
        result.createdTasks += tasks.length; actions.push(...tasks.map((task: any) => ({ type: "task", id: task.id })));
        result.alerts += await notify(supabase, account.id, triggerKey, current === "critical" ? "Plan anti-churn urgent" : "Plan anti-churn à lancer", `${accountName(account)} · santé ${account.health?.score ?? account.health_score}/100 · séquence de récupération créée.`, current === "critical" ? "urgent" : "warning");
        await successEvent(supabase, account.id, "risk", "Playbook anti-churn déclenché", `Passage à ${current} · ${account.health?.score ?? account.health_score}/100. Trois actions internes de récupération ont été créées.`);
        await finishRun(supabase, runId, "success", "Cas anti-churn et séquence interne créés.", actions);
        result.runs += 1;
      } catch (error) {
        await finishRun(supabase, runId, "failed", error instanceof Error ? error.message : "Échec du playbook anti-churn.", actions);
        throw error;
      }
    }
  } else if (isRisk(previous) && !isRisk(current)) {
    const closed = await supabase.from("website_crm_retention_cases").update({ status: "recovered", recovered_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: "MOONY Retention" }).eq("client_id", account.id).eq("trigger_type", "health_risk").in("status", ["open", "in_progress"]).select("id");
    if (!closed.error && closed.data?.length) {
      result.recoveredCases += closed.data.length;
      await successEvent(supabase, account.id, "health", "Risque client résorbé", `La santé Customer Success est revenue à ${current}. Les cas anti-churn ouverts ont été marqués comme récupérés.`);
      result.alerts += await notify(supabase, account.id, `recovered:${new Date().toISOString().slice(0, 10)}`, "Risque client résorbé", `${accountName(account)} est revenu au statut ${current}.`, "info");
    }
  }
  const state = await supabase.from("website_crm_client_accounts").update({ retention_last_health_status: current, retention_last_health_checked_at: new Date().toISOString() }).eq("id", account.id);
  if (state.error) throw new Error(state.error.message);
}

async function handleDetractor(supabase: any, account: any, surveys: any[], result: RetentionResult) {
  const latest = surveys.find((survey) => survey.status === "responded" && survey.score != null);
  if (!latest || Number(latest.score) > 6) return;
  const respondedAt = latest.responded_at || latest.updated_at || latest.sent_at;
  if (!respondedAt || Date.now() - new Date(respondedAt).getTime() > 30 * 86400000) return;
  const triggerKey = `nps:${latest.id}`;
  const runId = await beginRun(supabase, account.id, "nps_detractor", triggerKey, `NPS détracteur ${latest.score}/10`);
  if (!runId) return;
  const actions: unknown[] = [];
  try {
    const caseId = await createCase(supabase, account, "nps_detractor", triggerKey, `Récupération NPS · ${accountName(account)}`, "urgent", { surveyId: latest.id, score: latest.score, comment: latest.comment || null });
    if (caseId) { result.createdCases += 1; actions.push({ type: "case", id: caseId }); }
    const tasks = await createTasks(supabase, account, triggerKey, [
      { title: `Rappeler ${accountName(account)} — NPS ${latest.score}/10`, hours: 4, priority: "urgent", notes: "Contacter le client personnellement pour comprendre la cause du retour. Ne pas automatiser la réponse client." },
      { title: `Plan correctif après NPS — ${accountName(account)}`, hours: 24, priority: "high", notes: "Transformer le retour explicite en actions correctives avec responsables et échéances." },
      { title: `Confirmer la résolution — ${accountName(account)}`, hours: 72, priority: "high", notes: "Recontacter le client après les premières corrections et confirmer les prochaines étapes." },
    ]);
    result.createdTasks += tasks.length; actions.push(...tasks.map((task: any) => ({ type: "task", id: task.id })));
    result.alerts += await notify(supabase, account.id, triggerKey, "Séquence de récupération NPS créée", `${accountName(account)} · ${latest.score}/10 · actions urgentes assignées.`, "urgent");
    await successEvent(supabase, account.id, "risk", "Séquence de récupération NPS", `NPS ${latest.score}/10. Trois actions internes ont été créées pour traiter le retour client.`);
    await finishRun(supabase, runId, "success", "Cas NPS et séquence de récupération créés.", actions);
    result.runs += 1;
  } catch (error) {
    await finishRun(supabase, runId, "failed", error instanceof Error ? error.message : "Échec de la récupération NPS.", actions);
    throw error;
  }
}

async function handleRenewal(supabase: any, account: any, settings: RetentionSettings, growth: any[], result: RetentionResult) {
  const remaining = daysUntil(account.renewal_date);
  if (remaining == null || remaining < 0) return;
  const milestones = [settings.renewal_day_1, settings.renewal_day_2, settings.renewal_day_3].filter((value, index, all) => all.indexOf(value) === index).sort((a, b) => a - b);
  const milestone = milestones.find((value) => remaining <= value);
  if (!milestone) return;
  const triggerKey = `renewal:${account.renewal_date}:J${milestone}`;
  const runId = await beginRun(supabase, account.id, "renewal", triggerKey, `Renouvellement J-${milestone}`);
  if (!runId) return;
  const actions: unknown[] = [];
  try {
    if (milestone === Math.max(...milestones) && !growth.some((item) => item.kind === "renewal" && ["open", "planned"].includes(item.status))) {
      const opportunity = relation<any>(account.website_crm_opportunities);
      const created = await supabase.from("website_crm_client_growth_opportunities").insert({
        client_id: account.id,
        kind: "renewal",
        status: "open",
        title: `Renouvellement · ${accountName(account)}`,
        estimated_value: Math.max(0, Number(opportunity?.amount || 0)),
        currency: opportunity?.currency || "XOF",
        due_date: account.renewal_date,
        notes: "Créée automatiquement à partir de la date de renouvellement. La valeur reprend le dernier deal signé comme estimation de travail et doit être validée humainement.",
        created_by: "MOONY Retention",
        updated_by: "MOONY Retention",
      }).select("id").single();
      if (created.error) throw new Error(created.error.message);
      result.createdGrowth += 1; actions.push({ type: "growth", id: created.data.id, kind: "renewal" });
    }
    const urgency: "normal" | "high" | "urgent" = milestone <= settings.renewal_day_3 ? "urgent" : milestone <= settings.renewal_day_2 ? "high" : "normal";
    const title = milestone <= settings.renewal_day_3 ? `Sécuriser le renouvellement — ${accountName(account)}` : milestone <= settings.renewal_day_2 ? `Valider la proposition de renouvellement — ${accountName(account)}` : `Préparer le renouvellement — ${accountName(account)}`;
    const tasks = await createTasks(supabase, account, triggerKey, [{ title, hours: milestone <= settings.renewal_day_3 ? 4 : 24, priority: urgency, notes: `J-${milestone} avant renouvellement. Vérifier satisfaction, parties prenantes, valeur obtenue, conditions et prochaine décision. Aucune relance client n’est envoyée automatiquement.` }]);
    result.createdTasks += tasks.length; actions.push(...tasks.map((task: any) => ({ type: "task", id: task.id })));
    result.alerts += await notify(supabase, account.id, triggerKey, `Renouvellement J-${milestone}`, `${accountName(account)} · échéance ${account.renewal_date} · action interne créée.`, urgency === "urgent" ? "urgent" : urgency === "high" ? "warning" : "info");
    await successEvent(supabase, account.id, "renewal", `Renouvellement J-${milestone}`, "Une action interne de préparation du renouvellement a été créée.");
    await finishRun(supabase, runId, "success", `J-${milestone} traité.`, actions);
    result.runs += 1;
  } catch (error) {
    await finishRun(supabase, runId, "failed", error instanceof Error ? error.message : "Échec du jalon de renouvellement.", actions);
    throw error;
  }
}

async function handleExpansion(supabase: any, account: any, settings: RetentionSettings, growth: any[], result: RetentionResult) {
  const adoption = account.adoption_score == null ? null : Number(account.adoption_score);
  const latestNps = account.latestSurvey?.score ?? account.last_nps_score;
  if (account.status !== "active" || account.health?.status !== "healthy" || adoption == null || adoption < settings.expansion_adoption_threshold) return;
  if (String(account.churn_risk_notes || "").trim() || account.expansion_potential === "low" || (latestNps != null && Number(latestNps) <= 6)) return;
  if (growth.some((item) => ["upsell", "cross_sell"].includes(item.kind) && ["open", "planned"].includes(item.status))) return;
  const period = quarterKey();
  const triggerKey = `expansion:${period}`;
  const runId = await beginRun(supabase, account.id, "expansion", triggerKey, `Signal d’expansion ${period}`);
  if (!runId) return;
  const actions: unknown[] = [];
  try {
    const kind = account.expansion_potential === "high" ? "upsell" : "cross_sell";
    const created = await supabase.from("website_crm_client_growth_opportunities").insert({
      client_id: account.id,
      kind,
      status: "open",
      title: `${kind === "upsell" ? "Upsell" : "Cross-sell"} à qualifier · ${accountName(account)}`,
      estimated_value: 0,
      currency: relation<any>(account.website_crm_opportunities)?.currency || "XOF",
      due_date: addDays(30),
      notes: `Suggestion interne fondée sur des signaux Customer Success explicites : santé saine et adoption ${adoption} %. À qualifier humainement avant toute proposition au client.`,
      created_by: "MOONY Retention",
      updated_by: "MOONY Retention",
    }).select("id").single();
    if (created.error) throw new Error(created.error.message);
    result.createdGrowth += 1; actions.push({ type: "growth", id: created.data.id, kind });
    result.alerts += await notify(supabase, account.id, triggerKey, "Opportunité d’expansion à qualifier", `${accountName(account)} · santé saine · adoption ${adoption} % · ${kind === "upsell" ? "upsell" : "cross-sell"} suggéré.`, "info");
    await successEvent(supabase, account.id, "expansion", "Signal d’expansion détecté", `Santé saine et adoption ${adoption} %. Une opportunité ${kind} interne a été créée pour qualification humaine.`);
    await finishRun(supabase, runId, "success", "Opportunité d’expansion interne créée.", actions);
    result.runs += 1;
  } catch (error) {
    await finishRun(supabase, runId, "failed", error instanceof Error ? error.message : "Échec de la suggestion d’expansion.", actions);
    throw error;
  }
}

export async function runRetentionAutomations(supabase: any, options: RunOptions = {}): Promise<RetentionResult> {
  const result: RetentionResult = { available: true, enabled: false, processed: 0, createdCases: 0, createdTasks: 0, createdGrowth: 0, alerts: 0, runs: 0, recoveredCases: 0, errors: [] };
  const settingsResult = await supabase.from("website_crm_retention_settings").select("*").eq("id", "default").maybeSingle();
  if (settingsResult.error) {
    if (missing(settingsResult.error)) return { ...result, available: false };
    throw new Error(settingsResult.error.message);
  }
  const settings = (settingsResult.data ?? { id: "default", enabled: false, health_risk_enabled: true, nps_detractor_enabled: true, renewal_enabled: true, expansion_enabled: true, expansion_adoption_threshold: 85, renewal_day_1: 60, renewal_day_2: 30, renewal_day_3: 15 }) as RetentionSettings;
  result.enabled = Boolean(settings.enabled);
  if (!settings.enabled && !options.force) return result;

  const data = await loadCustomerSuccessData(supabase);
  if (!data.available) return { ...result, available: false };
  const wanted = options.clientIds?.length ? new Set(options.clientIds) : null;
  for (const account of data.accounts as any[]) {
    if (wanted && !wanted.has(String(account.id))) continue;
    result.processed += 1;
    const clientGrowth = data.growth[String(account.id)] ?? [];
    const clientSurveys = data.surveys[String(account.id)] ?? [];
    try {
      if (settings.health_risk_enabled) await handleHealthTransition(supabase, account, result);
      else await supabase.from("website_crm_client_accounts").update({ retention_last_health_status: account.health?.status || account.health_status, retention_last_health_checked_at: new Date().toISOString() }).eq("id", account.id);
      if (account.status !== "active") continue;
      if (settings.nps_detractor_enabled) await handleDetractor(supabase, account, clientSurveys, result);
      if (settings.renewal_enabled) await handleRenewal(supabase, account, settings, clientGrowth, result);
      if (settings.expansion_enabled) await handleExpansion(supabase, account, settings, clientGrowth, result);
    } catch (error) {
      result.errors.push(`${accountName(account)}: ${error instanceof Error ? error.message : "Erreur de rétention"}`);
    }
  }
  return result;
}
