import { DEFAULT_CRM_SCORING_SETTINGS, normalizeCrmScoringSettings, scoreCrmLead } from "@/lib/crm-scoring";
import { triggerLeadTagAddedAutomationEvents } from "@/lib/automation-engine";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const SCORE_TAGS = [
  { temperature: "hot", name: "Score chaud", slug: "score-chaud", color: "#b9693d" },
  { temperature: "warm", name: "Score tiède", slug: "score-tiede", color: "#d69a6d" },
  { temperature: "cold", name: "Score froid", slug: "score-froid", color: "#a9a29c" },
] as const;

export async function ensureCrmScoreTags(supabase: SupabaseAdmin) {
  const rows = SCORE_TAGS.map((tag) => ({ name: tag.name, slug: tag.slug, color: tag.color, created_by: "Scoring MOONY", updated_at: new Date().toISOString() }));
  const result = await supabase.from("website_crm_tags").upsert(rows, { onConflict: "slug" }).select("id,name,slug,color");
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function syncCrmScoreTags(supabase: SupabaseAdmin) {
  const scoreTags = await ensureCrmScoreTags(supabase);
  const scoreTagBySlug = new Map(scoreTags.map((tag) => [String(tag.slug), String(tag.id)]));
  const scoreTagIds = new Set(scoreTags.map((tag) => String(tag.id)));

  const [leadsResult, relationsResult, tasksResult, settingsResult] = await Promise.all([
    supabase.from("website_leads").select("id,first_name,last_name,email,phone,company,country,need,status,source,assigned_to,deal_value,created_at,updated_at,last_contacted_at").order("updated_at", { ascending: false }).limit(1000),
    supabase.from("website_crm_lead_tags").select("lead_id,tag_id"),
    supabase.from("website_crm_tasks").select("lead_id,due_at,status").in("status", ["todo", "in_progress"]).lt("due_at", new Date().toISOString()).limit(2000),
    supabase.from("website_crm_scoring_settings").select("stage_points,hot_threshold,warm_threshold,high_value_threshold,stale_after_days,tag_bonus_enabled").eq("id", "default").maybeSingle(),
  ]);
  if (leadsResult.error) throw new Error(leadsResult.error.message);

  const settings = !settingsResult.error && settingsResult.data
    ? normalizeCrmScoringSettings(settingsResult.data)
    : DEFAULT_CRM_SCORING_SETTINGS;

  const allTagsByLead = new Map<string, string[]>();
  if (!relationsResult.error) for (const relation of relationsResult.data ?? []) {
    const key = String(relation.lead_id);
    allTagsByLead.set(key, [...(allTagsByLead.get(key) ?? []), String(relation.tag_id)]);
  }
  const overdueByLead = new Map<string, number>();
  if (!tasksResult.error) for (const task of tasksResult.data ?? []) {
    const key = String(task.lead_id ?? "");
    if (!key) continue;
    overdueByLead.set(key, (overdueByLead.get(key) ?? 0) + 1);
  }

  let changed = 0;
  let hot = 0;
  let warm = 0;
  let cold = 0;
  const triggered: Array<{ leadId: string; tagId: string }> = [];

  for (const lead of leadsResult.data ?? []) {
    const leadId = String(lead.id);
    const currentTags = allTagsByLead.get(leadId) ?? [];
    const businessTagCount = currentTags.filter((tagId) => !scoreTagIds.has(tagId)).length;

    if (["won", "lost"].includes(String(lead.status))) {
      const currentScoreTags = currentTags.filter((tagId) => scoreTagIds.has(tagId));
      if (currentScoreTags.length) {
        const remove = await supabase.from("website_crm_lead_tags").delete().eq("lead_id", leadId).in("tag_id", currentScoreTags);
        if (remove.error) throw new Error(remove.error.message);
        changed += 1;
      }
      continue;
    }

    const scored = scoreCrmLead(lead as Record<string, unknown>, {
      settings,
      tagCount: businessTagCount,
      overdueTasks: overdueByLead.get(leadId) ?? 0,
    });
    if (scored.temperature === "hot") hot += 1;
    else if (scored.temperature === "warm") warm += 1;
    else cold += 1;

    const desiredSlug = scored.temperature === "hot" ? "score-chaud" : scored.temperature === "warm" ? "score-tiede" : "score-froid";
    const desiredTagId = scoreTagBySlug.get(desiredSlug);
    if (!desiredTagId) continue;
    const currentScoreTags = currentTags.filter((tagId) => scoreTagIds.has(tagId));
    const alreadyCorrect = currentScoreTags.length === 1 && currentScoreTags[0] === desiredTagId;
    if (alreadyCorrect) continue;

    if (currentScoreTags.length) {
      const remove = await supabase.from("website_crm_lead_tags").delete().eq("lead_id", leadId).in("tag_id", currentScoreTags);
      if (remove.error) throw new Error(remove.error.message);
    }
    const add = await supabase.from("website_crm_lead_tags").upsert({ lead_id: leadId, tag_id: desiredTagId, created_by: "Scoring MOONY" }, { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
    if (add.error) throw new Error(add.error.message);
    changed += 1;
    triggered.push({ leadId, tagId: desiredTagId });
  }

  for (const event of triggered) {
    try { await triggerLeadTagAddedAutomationEvents(supabase, [event.leadId], event.tagId); } catch {}
  }

  return { processed: (leadsResult.data ?? []).length, changed, hot, warm, cold, triggered: triggered.length, settingsAvailable: !settingsResult.error };
}
