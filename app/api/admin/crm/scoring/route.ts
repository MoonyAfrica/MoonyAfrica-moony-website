import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { ensureCrmScoreTags, syncCrmScoreTags } from "@/lib/crm-score-sync";
import { DEFAULT_CRM_SCORING_SETTINGS, normalizeCrmScoringSettings, scoreCrmLead } from "@/lib/crm-scoring";

async function bodyOf(request: Request) {
  try { return await request.json() as Record<string, unknown>; } catch { return null; }
}

function leadLabel(lead: Record<string, unknown>) {
  const company = typeof lead.company === "string" ? lead.company.trim() : "";
  const person = `${String(lead.first_name ?? "")} ${String(lead.last_name ?? "")}`.trim();
  return company || person || "Prospect";
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request, "crm.read");
  if (error || !supabase) return error;

  const nowIso = new Date().toISOString();
  const [leadsResult, tagsResult, scoreTagsResult, tasksResult, settingsResult] = await Promise.all([
    supabase.from("website_leads").select("id,first_name,last_name,email,phone,company,country,need,status,source,assigned_to,deal_value,created_at,updated_at,last_contacted_at").order("updated_at", { ascending: false }).limit(1000),
    supabase.from("website_crm_lead_tags").select("lead_id,tag_id"),
    supabase.from("website_crm_tags").select("id,slug").in("slug", ["score-chaud", "score-tiede", "score-froid"]),
    supabase.from("website_crm_tasks").select("lead_id,due_at,status").in("status", ["todo", "in_progress"]).lt("due_at", nowIso).limit(2000),
    supabase.from("website_crm_scoring_settings").select("stage_points,hot_threshold,warm_threshold,high_value_threshold,stale_after_days,tag_bonus_enabled,updated_at").eq("id", "default").maybeSingle(),
  ]);

  if (leadsResult.error) return NextResponse.json({ error: leadsResult.error.message }, { status: 500 });
  const settingsAvailable = !settingsResult.error;
  const settings = settingsAvailable && settingsResult.data
    ? normalizeCrmScoringSettings(settingsResult.data)
    : DEFAULT_CRM_SCORING_SETTINGS;

  const scoreTagIds = new Set((scoreTagsResult.error ? [] : scoreTagsResult.data ?? []).map((tag) => String(tag.id)));
  const tagsByLead = new Map<string, number>();
  if (!tagsResult.error) for (const relation of tagsResult.data ?? []) {
    if (scoreTagIds.has(String(relation.tag_id))) continue;
    const key = String(relation.lead_id);
    tagsByLead.set(key, (tagsByLead.get(key) ?? 0) + 1);
  }
  const overdueByLead = new Map<string, number>();
  if (!tasksResult.error) for (const task of tasksResult.data ?? []) {
    const key = String(task.lead_id ?? "");
    if (!key) continue;
    overdueByLead.set(key, (overdueByLead.get(key) ?? 0) + 1);
  }

  const scored = (leadsResult.data ?? []).map((lead) => {
    const result = scoreCrmLead(lead as Record<string, unknown>, {
      settings,
      tagCount: tagsByLead.get(String(lead.id)) ?? 0,
      overdueTasks: overdueByLead.get(String(lead.id)) ?? 0,
    });
    return {
      id: lead.id,
      name: leadLabel(lead as Record<string, unknown>),
      firstName: lead.first_name,
      lastName: lead.last_name,
      company: lead.company,
      email: lead.email,
      country: lead.country,
      need: lead.need,
      status: lead.status,
      assignedTo: lead.assigned_to,
      dealValue: Number(lead.deal_value || 0),
      lastContactedAt: lead.last_contacted_at,
      tagCount: tagsByLead.get(String(lead.id)) ?? 0,
      overdueTasks: overdueByLead.get(String(lead.id)) ?? 0,
      ...result,
    };
  }).sort((a, b) => b.score - a.score || b.dealValue - a.dealValue);

  const active = scored.filter((lead) => !["won", "lost"].includes(String(lead.status)));
  const averageScore = active.length ? Math.round(active.reduce((sum, lead) => sum + lead.score, 0) / active.length) : 0;
  return NextResponse.json({
    settings: {
      ...settings,
      settingsAvailable,
      updatedAt: settingsResult.data?.updated_at ?? null,
    },
    metrics: {
      total: scored.length,
      active: active.length,
      hot: active.filter((lead) => lead.temperature === "hot").length,
      warm: active.filter((lead) => lead.temperature === "warm").length,
      cold: active.filter((lead) => lead.temperature === "cold").length,
      urgent: active.filter((lead) => lead.priority === "urgent").length,
      averageScore,
      hotPipelineValue: active.filter((lead) => lead.temperature === "hot").reduce((sum, lead) => sum + lead.dealValue, 0),
    },
    leads: scored.slice(0, 250),
  });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write");
  if (error || !supabase) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const normalized = normalizeCrmScoringSettings({
    stagePoints: body.stagePoints,
    hotThreshold: body.hotThreshold,
    warmThreshold: body.warmThreshold,
    highValueThreshold: body.highValueThreshold,
    staleAfterDays: body.staleAfterDays,
    tagBonusEnabled: body.tagBonusEnabled,
  });
  const updatedBy = session?.name || session?.email || "MOONY Admin";
  const { data, error: upsertError } = await supabase.from("website_crm_scoring_settings").upsert({
    id: "default",
    stage_points: normalized.stagePoints,
    hot_threshold: normalized.hotThreshold,
    warm_threshold: normalized.warmThreshold,
    high_value_threshold: normalized.highValueThreshold,
    stale_after_days: normalized.staleAfterDays,
    tag_bonus_enabled: normalized.tagBonusEnabled,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" }).select("*").single();

  if (upsertError) {
    if (upsertError.code === "42P01") return NextResponse.json({ error: "Appliquez la migration CRM Scoring pour enregistrer ces paramètres." }, { status: 409 });
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }
  await writeAuditLog(supabase, session, "crm.scoring_settings_updated", "crm_scoring", "default", "Paramètres de scoring commercial modifiés", {
    hotThreshold: normalized.hotThreshold,
    warmThreshold: normalized.warmThreshold,
    highValueThreshold: normalized.highValueThreshold,
    staleAfterDays: normalized.staleAfterDays,
    tagBonusEnabled: normalized.tagBonusEnabled,
  });
  return NextResponse.json({ settings: data });
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write");
  if (error || !supabase) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const action = asText(body.action, 40);

  if (action === "sync_priority_tags") {
    try {
      const result = await syncCrmScoreTags(supabase);
      await writeAuditLog(supabase, session, "crm.scoring_tags_synced", "crm_scoring", "default", "Priorités de scoring synchronisées avec les tags CRM", result);
      return NextResponse.json({ result });
    } catch (syncError) {
      return NextResponse.json({ error: syncError instanceof Error ? syncError.message : "Synchronisation impossible." }, { status: 500 });
    }
  }

  if (action === "create_hot_automation") {
    let tags;
    try { tags = await ensureCrmScoreTags(supabase); }
    catch (tagError) { return NextResponse.json({ error: tagError instanceof Error ? tagError.message : "Impossible de préparer les tags de scoring." }, { status: 500 }); }
    const hotTag = tags.find((tag) => tag.slug === "score-chaud");
    if (!hotTag) return NextResponse.json({ error: "Le tag Score chaud n’a pas pu être créé." }, { status: 500 });

    const settingsResult = await supabase.from("website_crm_scoring_settings").select("hot_threshold").eq("id", "default").maybeSingle();
    const threshold = !settingsResult.error && settingsResult.data ? Number(settingsResult.data.hot_threshold || 70) : 70;
    const { data, error: insertError } = await supabase.from("control_center_automation_rules").insert({
      name: `Prospect chaud (score ≥ ${threshold}) → relance prioritaire`,
      description: "Déclenchée quand le scoring MOONY classe un prospect comme chaud et lui attribue le tag Score chaud.",
      trigger_type: "lead_tag_added",
      enabled: false,
      conditions: { tag_ids: [hotTag.id] },
      actions: [
        { type: "create_crm_task", title: "Contacter en priorité {{lead}}", due_in_hours: 4, priority: "urgent", delay_hours: 0 },
        { type: "notify_role", role: "sales", title: "Prospect chaud à traiter", subtitle: "{{lead}} vient de passer en priorité chaude.", href: "/admin/crm?lead={{lead_id}}", severity: "urgent", delay_hours: 0 },
      ],
      created_by: session?.name || session?.email || "MOONY Admin",
      updated_at: new Date().toISOString(),
    }).select("*").single();
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    await writeAuditLog(supabase, session, "crm.scoring_automation_created", "automation_rule", data.id, `Automatisation prospects chauds créée via le tag Score chaud`, { threshold, hotTagId: hotTag.id });
    return NextResponse.json({ rule: data }, { status: 201 });
  }

  return NextResponse.json({ error: "Action non prise en charge." }, { status: 422 });
}
