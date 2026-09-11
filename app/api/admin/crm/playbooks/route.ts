import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { DEFAULT_CRM_SCORING_SETTINGS, normalizeCrmScoringSettings, scoreCrmLead } from "@/lib/crm-scoring";
import { crmPlaybookMatches, normalizedCrmPlaybookGuidance, playbookLeadStaleDays, rankCrmPlaybooks, renderCrmPlaybookTemplate, type CrmPlaybookRecord } from "@/lib/crm-playbooks";

async function bodyOf(request: Request) {
  try { return await request.json() as Record<string, unknown>; } catch { return null; }
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function list(value: unknown, max = 20, maxLength = 120) {
  return Array.isArray(value) ? value.map((item) => asText(item, maxLength)).filter(Boolean).slice(0, max) : [];
}

function numberBetween(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function cleanConditions(value: unknown) {
  const source = object(value);
  const conditions: Record<string, unknown> = {};
  const statuses = list(source.statuses, 20, 60);
  const needs = list(source.needs, 20, 80);
  const temperatures = list(source.temperatures, 3, 20).filter((item) => ["hot", "warm", "cold"].includes(item));
  if (statuses.length) conditions.statuses = statuses;
  if (needs.length) conditions.needs = needs;
  if (temperatures.length) conditions.temperatures = temperatures;
  for (const [key, min, max] of [
    ["min_score", 0, 100], ["max_score", 0, 100], ["min_deal_value", 0, 1_000_000_000], ["stale_min_days", 0, 365],
  ] as const) {
    if (source[key] !== undefined && source[key] !== "") conditions[key] = numberBetween(source[key], min, max, min);
  }
  return conditions;
}

function cleanGuidance(value: unknown) {
  const source = normalizedCrmPlaybookGuidance(value);
  return {
    objective: source.objective || "",
    next_action: source.next_action || "",
    due_in_hours: source.due_in_hours ?? 24,
    task_priority: source.task_priority ?? "normal",
    channel: source.channel ?? "email",
    argument_points: source.argument_points ?? [],
    message_template: source.message_template ?? "",
  };
}

function leadName(lead: Record<string, unknown>) {
  const company = String(lead.company ?? "").trim();
  const person = `${String(lead.first_name ?? "")} ${String(lead.last_name ?? "")}`.trim();
  return company || person || "Prospect";
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request, "crm.read");
  if (error || !supabase) return error;

  const [playbooksResult, leadsResult, tagsResult, tasksResult, scoringResult, runsResult] = await Promise.all([
    supabase.from("website_crm_playbooks").select("id,system_key,name,description,active,priority,conditions,guidance,created_by,updated_by,updated_at").order("priority", { ascending: true }).order("updated_at", { ascending: false }),
    supabase.from("website_leads").select("id,first_name,last_name,email,phone,company,country,need,status,source,assigned_to,deal_value,created_at,updated_at,last_contacted_at").order("updated_at", { ascending: false }).limit(1000),
    supabase.from("website_crm_lead_tags").select("lead_id,tag_id"),
    supabase.from("website_crm_tasks").select("lead_id,due_at,status").in("status", ["todo", "in_progress"]).lt("due_at", new Date().toISOString()).limit(2000),
    supabase.from("website_crm_scoring_settings").select("stage_points,hot_threshold,warm_threshold,high_value_threshold,stale_after_days,tag_bonus_enabled").eq("id", "default").maybeSingle(),
    supabase.from("website_crm_playbook_runs").select("id,playbook_id,lead_id,status,applied_by,created_at,completed_at").order("created_at", { ascending: false }).limit(200),
  ]);

  if (playbooksResult.error) {
    if (playbooksResult.error.code === "42P01") return NextResponse.json({ available: false, playbooks: [], recommendations: [], recentRuns: [], metrics: { activePlaybooks: 0, recommendations: 0, urgent: 0, dueToday: 0 } });
    return NextResponse.json({ error: playbooksResult.error.message }, { status: 500 });
  }
  if (leadsResult.error) return NextResponse.json({ error: leadsResult.error.message }, { status: 500 });

  const scoringSettings = !scoringResult.error && scoringResult.data ? normalizeCrmScoringSettings(scoringResult.data) : DEFAULT_CRM_SCORING_SETTINGS;
  const tagCountByLead = new Map<string, number>();
  if (!tagsResult.error) for (const relation of tagsResult.data ?? []) {
    const key = String(relation.lead_id);
    tagCountByLead.set(key, (tagCountByLead.get(key) ?? 0) + 1);
  }
  const overdueByLead = new Map<string, number>();
  if (!tasksResult.error) for (const task of tasksResult.data ?? []) {
    const key = String(task.lead_id ?? "");
    if (!key) continue;
    overdueByLead.set(key, (overdueByLead.get(key) ?? 0) + 1);
  }

  const playbooks = (playbooksResult.data ?? []) as unknown as CrmPlaybookRecord[];
  const now = Date.now();
  const recommendations = (leadsResult.data ?? [])
    .filter((lead) => !["won", "lost"].includes(String(lead.status)))
    .map((lead) => {
      const score = scoreCrmLead(lead as Record<string, unknown>, {
        settings: scoringSettings,
        tagCount: tagCountByLead.get(String(lead.id)) ?? 0,
        overdueTasks: overdueByLead.get(String(lead.id)) ?? 0,
        now,
      });
      const enriched = { ...lead, ...score };
      const matches = rankCrmPlaybooks(playbooks, enriched);
      const best = matches[0];
      if (!best) return null;
      const guidance = normalizedCrmPlaybookGuidance(best.guidance);
      return {
        lead: {
          id: lead.id,
          name: leadName(lead as Record<string, unknown>),
          firstName: lead.first_name,
          lastName: lead.last_name,
          email: lead.email,
          company: lead.company,
          country: lead.country,
          need: lead.need,
          status: lead.status,
          assignedTo: lead.assigned_to,
          dealValue: Number(lead.deal_value || 0),
          staleDays: playbookLeadStaleDays(enriched, now),
          score: score.score,
          temperature: score.temperature,
          scorePriority: score.priority,
          signals: score.signals,
        },
        playbook: {
          id: best.id,
          name: best.name,
          description: best.description ?? "",
          systemKey: best.system_key ?? null,
          objective: guidance.objective ?? "",
          nextAction: guidance.next_action ?? "",
          dueInHours: guidance.due_in_hours ?? 24,
          taskPriority: guidance.task_priority ?? "normal",
          channel: guidance.channel ?? "email",
          argumentPoints: guidance.argument_points ?? [],
          message: renderCrmPlaybookTemplate(guidance.message_template, enriched),
        },
        alternatives: matches.slice(1, 4).map((item) => ({ id: item.id, name: item.name })),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a || !b) return 0;
      const urgency = (item: typeof a) => item?.lead.scorePriority === "urgent" ? 4 : item?.lead.scorePriority === "high" ? 3 : item?.lead.scorePriority === "normal" ? 2 : 1;
      return urgency(b) - urgency(a) || Number(b?.lead.score || 0) - Number(a?.lead.score || 0) || Number(b?.lead.dealValue || 0) - Number(a?.lead.dealValue || 0);
    });

  const dueToday = recommendations.filter((item) => item && Number(item.playbook.dueInHours) <= 24).length;
  return NextResponse.json({
    available: true,
    playbooks: (playbooksResult.data ?? []).map((playbook) => ({ ...playbook, guidance: cleanGuidance(playbook.guidance), conditions: cleanConditions(playbook.conditions) })),
    recommendations,
    recentRuns: runsResult.error ? [] : (runsResult.data ?? []),
    metrics: {
      activePlaybooks: (playbooksResult.data ?? []).filter((playbook) => playbook.active).length,
      recommendations: recommendations.length,
      urgent: recommendations.filter((item) => item?.lead.scorePriority === "urgent").length,
      dueToday,
    },
  });
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write");
  if (error || !supabase || !session) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const action = asText(body.action, 40) || "apply";

  if (action === "create") {
    const name = asText(body.name, 180);
    if (!name) return NextResponse.json({ error: "Le nom du playbook est obligatoire." }, { status: 422 });
    const { data, error: insertError } = await supabase.from("website_crm_playbooks").insert({
      name,
      description: asNullableText(body.description, 800),
      active: body.active !== false,
      priority: Math.round(numberBetween(body.priority, 1, 1000, 100)),
      conditions: cleanConditions(body.conditions),
      guidance: cleanGuidance(body.guidance),
      created_by: session.name || session.email || "MOONY Admin",
      updated_by: session.name || session.email || "MOONY Admin",
      updated_at: new Date().toISOString(),
    }).select("*").single();
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    await writeAuditLog(supabase, session, "crm.playbook_created", "crm_playbook", data.id, `Playbook « ${data.name} » créé`, { priority: data.priority });
    return NextResponse.json({ playbook: data }, { status: 201 });
  }

  if (action !== "apply") return NextResponse.json({ error: "Action non prise en charge." }, { status: 422 });
  const leadId = asText(body.leadId, 80);
  const playbookId = asText(body.playbookId, 80);
  if (!leadId || !playbookId) return NextResponse.json({ error: "Prospect et playbook obligatoires." }, { status: 422 });

  const [leadResult, playbookResult, scoringResult] = await Promise.all([
    supabase.from("website_leads").select("id,first_name,last_name,email,phone,company,country,need,status,source,assigned_to,deal_value,created_at,last_contacted_at").eq("id", leadId).maybeSingle(),
    supabase.from("website_crm_playbooks").select("id,system_key,name,description,active,priority,conditions,guidance").eq("id", playbookId).maybeSingle(),
    supabase.from("website_crm_scoring_settings").select("stage_points,hot_threshold,warm_threshold,high_value_threshold,stale_after_days,tag_bonus_enabled").eq("id", "default").maybeSingle(),
  ]);
  if (leadResult.error || !leadResult.data) return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });
  if (playbookResult.error || !playbookResult.data) return NextResponse.json({ error: "Playbook introuvable." }, { status: 404 });
  if (!playbookResult.data.active) return NextResponse.json({ error: "Ce playbook est désactivé." }, { status: 409 });

  const scoringSettings = !scoringResult.error && scoringResult.data ? normalizeCrmScoringSettings(scoringResult.data) : DEFAULT_CRM_SCORING_SETTINGS;
  const [tagCountResult, overdueResult] = await Promise.all([
    supabase.from("website_crm_lead_tags").select("tag_id", { count: "exact", head: true }).eq("lead_id", leadId),
    supabase.from("website_crm_tasks").select("id", { count: "exact", head: true }).eq("lead_id", leadId).in("status", ["todo", "in_progress"]).lt("due_at", new Date().toISOString()),
  ]);
  const score = scoreCrmLead(leadResult.data as Record<string, unknown>, { settings: scoringSettings, tagCount: tagCountResult.count ?? 0, overdueTasks: overdueResult.count ?? 0 });
  const enriched = { ...leadResult.data, ...score };
  const playbook = playbookResult.data as unknown as CrmPlaybookRecord;
  if (!crmPlaybookMatches(playbook, enriched)) return NextResponse.json({ error: "Ce playbook ne correspond plus aux critères actuels du prospect." }, { status: 409 });
  const guidance = normalizedCrmPlaybookGuidance(playbook.guidance);
  const dueAt = new Date(Date.now() + Number(guidance.due_in_hours ?? 24) * 3600000).toISOString();
  const taskTitle = guidance.next_action || `Appliquer le playbook ${playbook.name}`;
  const message = renderCrmPlaybookTemplate(guidance.message_template, enriched);

  const taskResult = await supabase.from("website_crm_tasks").insert({
    lead_id: leadId,
    title: taskTitle.slice(0, 260),
    due_at: dueAt,
    status: "todo",
    priority: guidance.task_priority ?? "normal",
    assigned_to: leadResult.data.assigned_to || session.name || session.email,
    notes: `Playbook : ${playbook.name}\nCanal recommandé : ${guidance.channel || "email"}\nObjectif : ${guidance.objective || ""}`.slice(0, 2000),
    metadata: { source: "crm-playbook", playbook_id: playbookId, score: score.score, temperature: score.temperature },
  }).select("id").single();
  if (taskResult.error) return NextResponse.json({ error: taskResult.error.message }, { status: 500 });

  const snapshot = {
    playbookName: playbook.name,
    score: score.score,
    temperature: score.temperature,
    objective: guidance.objective,
    nextAction: guidance.next_action,
    channel: guidance.channel,
    argumentPoints: guidance.argument_points,
    message,
    taskId: taskResult.data.id,
    dueAt,
  };
  const runResult = await supabase.from("website_crm_playbook_runs").insert({
    playbook_id: playbookId,
    lead_id: leadId,
    status: "applied",
    applied_by: session.name || session.email || "MOONY Admin",
    snapshot,
  }).select("id").single();
  if (runResult.error) return NextResponse.json({ error: runResult.error.message }, { status: 500 });

  await supabase.from("website_crm_activities").insert({
    lead_id: leadId,
    kind: "note",
    summary: `Playbook appliqué : ${playbook.name}`,
    body: `${guidance.next_action || "Action commerciale recommandée"}${guidance.argument_points?.length ? `\n\nArgumentaire :\n- ${guidance.argument_points.join("\n- ")}` : ""}`.slice(0, 4000),
    created_by: session.name || session.email || "Équipe MOONY",
    metadata: { playbook_id: playbookId, playbook_run_id: runResult.data.id, score: score.score },
  });
  await writeAuditLog(supabase, session, "crm.playbook_applied", "lead", leadId, `Playbook « ${playbook.name} » appliqué à ${leadName(leadResult.data as Record<string, unknown>)}`, { playbookId, runId: runResult.data.id, taskId: taskResult.data.id, score: score.score });
  return NextResponse.json({ ok: true, runId: runResult.data.id, taskId: taskResult.data.id, dueAt, message });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write");
  if (error || !supabase || !session) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const id = asText(body.id, 80);
  if (!id) return NextResponse.json({ error: "Playbook introuvable." }, { status: 422 });

  const patch: Record<string, unknown> = { updated_by: session.name || session.email || "MOONY Admin", updated_at: new Date().toISOString() };
  if ("name" in body) patch.name = asText(body.name, 180);
  if ("description" in body) patch.description = asNullableText(body.description, 800);
  if ("active" in body) patch.active = Boolean(body.active);
  if ("priority" in body) patch.priority = Math.round(numberBetween(body.priority, 1, 1000, 100));
  if ("conditions" in body) patch.conditions = cleanConditions(body.conditions);
  if ("guidance" in body) patch.guidance = cleanGuidance(body.guidance);
  const { data, error: updateError } = await supabase.from("website_crm_playbooks").update(patch).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await writeAuditLog(supabase, session, "crm.playbook_updated", "crm_playbook", id, `Playbook « ${data.name} » modifié`, { active: data.active, priority: data.priority });
  return NextResponse.json({ playbook: data });
}

export async function DELETE(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write");
  if (error || !supabase || !session) return error;
  const id = new URL(request.url).searchParams.get("id")?.trim() || "";
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });
  const before = await supabase.from("website_crm_playbooks").select("name,system_key").eq("id", id).maybeSingle();
  if (before.error || !before.data) return NextResponse.json({ error: "Playbook introuvable." }, { status: 404 });
  if (before.data.system_key) return NextResponse.json({ error: "Les playbooks système peuvent être désactivés ou modifiés, mais pas supprimés." }, { status: 409 });
  const result = await supabase.from("website_crm_playbooks").delete().eq("id", id);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  await writeAuditLog(supabase, session, "crm.playbook_deleted", "crm_playbook", id, `Playbook « ${before.data.name} » supprimé`);
  return NextResponse.json({ ok: true });
}
