import { NextResponse } from "next/server";
import { runDueAutomationJobs, runScheduledAutomations } from "@/lib/automation-engine";
import { syncAccountGovernance } from "@/lib/crm-account-governance";
import { syncWonOpportunitiesToOnboarding } from "@/lib/crm-onboarding";
import { syncCustomerSuccessHealth } from "@/lib/crm-customer-success";
import { runRetentionAutomations } from "@/lib/crm-retention-automations";
import { runProposalFollowups } from "@/lib/crm-proposal-followups";
import { syncCrmScoreTags } from "@/lib/crm-score-sync";
import { syncSuccessPlanReviews } from "@/lib/crm-success-plans";
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

    let proposalFollowups: Awaited<ReturnType<typeof runProposalFollowups>> | null = null;
    let proposalFollowupError: string | null = null;
    try { proposalFollowups = await runProposalFollowups(supabase); }
    catch (error) { proposalFollowupError = error instanceof Error ? error.message : "Relances de propositions indisponibles."; }

    let onboardingSync: Awaited<ReturnType<typeof syncWonOpportunitiesToOnboarding>> | null = null;
    let onboardingError: string | null = null;
    try { onboardingSync = await syncWonOpportunitiesToOnboarding(supabase); }
    catch (error) { onboardingError = error instanceof Error ? error.message : "Synchronisation onboarding indisponible."; }

    let customerSuccess: Awaited<ReturnType<typeof syncCustomerSuccessHealth>> | null = null;
    let customerSuccessError: string | null = null;
    try { customerSuccess = await syncCustomerSuccessHealth(supabase); }
    catch (error) { customerSuccessError = error instanceof Error ? error.message : "Surveillance Customer Success indisponible."; }

    let retention: Awaited<ReturnType<typeof runRetentionAutomations>> | null = null;
    let retentionError: string | null = null;
    let successPlans: Awaited<ReturnType<typeof syncSuccessPlanReviews>> | null = null;
    let successPlansError: string | null = null;
    let accountGovernance: Awaited<ReturnType<typeof syncAccountGovernance>> | null = null;
    let accountGovernanceError: string | null = null;
    if (!customerSuccessError) {
      try { retention = await runRetentionAutomations(supabase); }
      catch (error) { retentionError = error instanceof Error ? error.message : "Automatisations de rétention indisponibles."; }
      try { successPlans = await syncSuccessPlanReviews(supabase); }
      catch (error) { successPlansError = error instanceof Error ? error.message : "Préparation des revues clients indisponible."; }
      try { accountGovernance = await syncAccountGovernance(supabase); }
      catch (error) { accountGovernanceError = error instanceof Error ? error.message : "Gouvernance des comptes indisponible."; }
    }

    const [scheduled, delayed] = await Promise.all([
      runScheduledAutomations(supabase),
      runDueAutomationJobs(supabase),
    ]);
    const results = [...scheduled, ...delayed];
    const success = results.filter((item) => item.status === "success").length;
    const failed = results.filter((item) => item.status === "failed").length;
    const skipped = results.filter((item) => item.status === "skipped").length;
    const followupFailed = Boolean(proposalFollowupError || (proposalFollowups?.available && proposalFollowups.errors.length));
    const onboardingFailed = Boolean(onboardingError || (onboardingSync?.available && onboardingSync.errors.length));
    const customerSuccessFailed = Boolean(customerSuccessError || (customerSuccess?.available && customerSuccess.errors.length));
    const retentionFailed = Boolean(retentionError || (retention?.available && retention.errors.length));
    const successPlansFailed = Boolean(successPlansError || (successPlans?.available && successPlans.errors.length));
    const accountGovernanceFailed = Boolean(accountGovernanceError || (accountGovernance?.available && accountGovernance.errors.length));
    return NextResponse.json({
      ok: failed === 0 && !scoringError && !followupFailed && !onboardingFailed && !customerSuccessFailed && !retentionFailed && !successPlansFailed && !accountGovernanceFailed,
      summary: { success, failed, skipped, total: results.length, scheduled: scheduled.length, delayed: delayed.length },
      scoring,
      scoringError,
      proposalFollowups,
      proposalFollowupError,
      onboardingSync,
      onboardingError,
      customerSuccess,
      customerSuccessError,
      retention,
      retentionError,
      successPlans,
      successPlansError,
      accountGovernance,
      accountGovernanceError,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur d’automatisation." }, { status: 500 });
  }
}
