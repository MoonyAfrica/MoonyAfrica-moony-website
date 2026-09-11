import { NextResponse } from "next/server";
import { runDueAutomationJobs, runScheduledAutomations } from "@/lib/automation-engine";
import { syncCrmScoreTags } from "@/lib/crm-score-sync";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function authorized(request: Request) {
  const secret = process.env.AUTOMATION_CRON_SECRET ?? process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase n’est pas configuré." }, { status: 503 });

  try {
    let scoring: Awaited<ReturnType<typeof syncCrmScoreTags>> | null = null;
    let scoringError: string | null = null;
    try { scoring = await syncCrmScoreTags(supabase); }
    catch (error) { scoringError = error instanceof Error ? error.message : "Synchronisation scoring indisponible."; }

    const [scheduled, delayed] = await Promise.all([
      runScheduledAutomations(supabase),
      runDueAutomationJobs(supabase),
    ]);
    const results = [...scheduled, ...delayed];
    const success = results.filter((item) => item.status === "success").length;
    const failed = results.filter((item) => item.status === "failed").length;
    const skipped = results.filter((item) => item.status === "skipped").length;
    return NextResponse.json({
      ok: failed === 0 && !scoringError,
      summary: { success, failed, skipped, total: results.length, scheduled: scheduled.length, delayed: delayed.length },
      scoring,
      scoringError,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur d’automatisation." }, { status: 500 });
  }
}
