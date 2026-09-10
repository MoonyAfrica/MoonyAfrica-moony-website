import { NextResponse } from "next/server";
import { runScheduledAutomations } from "@/lib/automation-engine";
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
    const results = await runScheduledAutomations(supabase);
    const success = results.filter((item) => item.status === "success").length;
    const failed = results.filter((item) => item.status === "failed").length;
    const skipped = results.filter((item) => item.status === "skipped").length;
    return NextResponse.json({ ok: failed === 0, summary: { success, failed, skipped, total: results.length } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur d’automatisation." }, { status: 500 });
  }
}
