import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { triggerLeadTagAddedAutomationEvents } from "@/lib/automation-engine";

const statuses = new Set(["new","to_contact","contacted","appointment","proposal","negotiation","won","lost"]);
const priorities = new Set(["low","normal","high","urgent"]);

async function bodyOf(request: Request) {
  try { return await request.json() as Record<string, unknown>; } catch { return null; }
}

function leadIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))].slice(0, 200);
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write");
  if (error || !supabase || !session) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const ids = leadIds(body.ids);
  const action = asText(body.action, 40);
  if (!ids.length) return NextResponse.json({ error: "Sélectionnez au moins un prospect." }, { status: 422 });

  if (action === "status") {
    const status = asText(body.status, 40);
    if (!statuses.has(status)) return NextResponse.json({ error: "Étape CRM invalide." }, { status: 422 });
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "contacted") patch.last_contacted_at = new Date().toISOString();
    const { error: updateError } = await supabase.from("website_leads").update(patch).in("id", ids);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    await writeAuditLog(supabase, session, "crm.bulk_status", "lead_batch", null, `${ids.length} prospect(s) déplacé(s) dans le pipeline`, { ids, status });
    return NextResponse.json({ ok: true, affected: ids.length });
  }

  if (action === "assign") {
    const assignedTo = asNullableText(body.assignedTo, 180);
    const { error: updateError } = await supabase.from("website_leads").update({ assigned_to: assignedTo, updated_at: new Date().toISOString() }).in("id", ids);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    await writeAuditLog(supabase, session, "crm.bulk_assign", "lead_batch", null, `${ids.length} prospect(s) réassigné(s)`, { ids, assignedTo });
    return NextResponse.json({ ok: true, affected: ids.length });
  }

  if (action === "add_tag") {
    const tagId = asText(body.tagId, 80);
    if (!tagId) return NextResponse.json({ error: "Tag manquant." }, { status: 422 });
    const rows = ids.map((leadId) => ({ lead_id: leadId, tag_id: tagId, created_by: session.name || session.email || "MOONY Admin" }));
    const { error: tagError } = await supabase.from("website_crm_lead_tags").upsert(rows, { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
    if (tagError) return NextResponse.json({ error: tagError.message }, { status: 500 });
    await writeAuditLog(supabase, session, "crm.bulk_tag_added", "lead_batch", null, `Tag ajouté à ${ids.length} prospect(s)`, { ids, tagId });
    try { await triggerLeadTagAddedAutomationEvents(supabase, ids, tagId); } catch {}
    return NextResponse.json({ ok: true, affected: ids.length });
  }

  if (action === "remove_tag") {
    const tagId = asText(body.tagId, 80);
    if (!tagId) return NextResponse.json({ error: "Tag manquant." }, { status: 422 });
    const { error: tagError } = await supabase.from("website_crm_lead_tags").delete().eq("tag_id", tagId).in("lead_id", ids);
    if (tagError) return NextResponse.json({ error: tagError.message }, { status: 500 });
    await writeAuditLog(supabase, session, "crm.bulk_tag_removed", "lead_batch", null, `Tag retiré de ${ids.length} prospect(s)`, { ids, tagId });
    return NextResponse.json({ ok: true, affected: ids.length });
  }

  if (action === "create_task") {
    const title = asText(body.title, 260);
    if (!title) return NextResponse.json({ error: "Le titre de la tâche est obligatoire." }, { status: 422 });
    const priorityValue = asText(body.priority, 40);
    const priority = priorities.has(priorityValue) ? priorityValue : "normal";
    const dueAt = asNullableText(body.dueAt, 80);
    const assignedTo = asNullableText(body.assignedTo, 180);
    const notes = asNullableText(body.notes, 2000);
    const rows = ids.map((leadId) => ({ lead_id: leadId, title, due_at: dueAt, status: "todo", priority, assigned_to: assignedTo, notes, metadata: { source: "crm-bulk-action" } }));
    const { error: taskError } = await supabase.from("website_crm_tasks").insert(rows);
    if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });
    await writeAuditLog(supabase, session, "crm.bulk_task_created", "lead_batch", null, `${ids.length} tâche(s) commerciale(s) créée(s)`, { ids, title, dueAt, priority, assignedTo });
    return NextResponse.json({ ok: true, affected: ids.length });
  }

  if (action === "add_note") {
    const summary = asText(body.summary, 260);
    const noteBody = asNullableText(body.body, 4000);
    if (!summary) return NextResponse.json({ error: "Le résumé de la note est obligatoire." }, { status: 422 });
    const rows = ids.map((leadId) => ({ lead_id: leadId, kind: "note", summary, body: noteBody, created_by: session.name || session.email || "Équipe MOONY", metadata: { source: "crm-bulk-action" } }));
    const { error: noteError } = await supabase.from("website_crm_activities").insert(rows);
    if (noteError) return NextResponse.json({ error: noteError.message }, { status: 500 });
    await writeAuditLog(supabase, session, "crm.bulk_note_created", "lead_batch", null, `Note ajoutée à ${ids.length} prospect(s)`, { ids, summary });
    return NextResponse.json({ ok: true, affected: ids.length });
  }

  return NextResponse.json({ error: "Action groupée non prise en charge." }, { status: 422 });
}
