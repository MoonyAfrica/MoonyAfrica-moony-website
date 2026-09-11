import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { runDueAutomationJobs, runScheduledAutomations } from "@/lib/automation-engine";

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "settings.write");
  if (error || !supabase) return error;

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch {}
  const ruleId = asText(body.ruleId, 80) || undefined;

  try {
    const scheduled = await runScheduledAutomations(supabase, ruleId);
    const delayed = ruleId ? [] : await runDueAutomationJobs(supabase);
    const results = [...scheduled, ...delayed];
    const success = results.filter((item) => item.status === "success").length;
    const failed = results.filter((item) => item.status === "failed").length;
    const skipped = results.filter((item) => item.status === "skipped").length;
    await writeAuditLog(supabase, session, "automation.manual_run", "automation", ruleId || null, ruleId ? "Automatisation exécutée manuellement" : "Automatisations exécutées manuellement", { success, failed, skipped, delayed: delayed.length });
    return NextResponse.json({ results, summary: { success, failed, skipped, total: results.length, delayed: delayed.length } });
  } catch (runError) {
    return NextResponse.json({ error: runError instanceof Error ? runError.message : "L’exécution des automatisations a échoué." }, { status: 500 });
  }
}
