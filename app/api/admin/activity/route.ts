import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { hasAdminPermission } from "@/lib/admin-auth";

type AuditRow = {
  id: string;
  created_at: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
};

function moduleFor(action: string, entityType: string | null) {
  const value = `${action} ${entityType ?? ""}`.toLowerCase();
  if (value.includes("automation")) return "settings";
  if (value.includes("crm") || value.includes("lead")) return "crm";
  if (value.includes("support") || value.includes("ticket")) return "support";
  if (value.includes("appointment") || value.includes("rendez")) return "appointments";
  if (value.includes("newsletter") || value.includes("marketing") || value.includes("campaign")) return "marketing";
  if (value.includes("cms") || value.includes("page") || value.includes("site")) return "site";
  if (value.includes("content") || value.includes("article") || value.includes("resource") || value.includes("media") || value.includes("testimonial") || value.includes("partner")) return "content";
  if (value.includes("seo")) return "seo";
  if (value.includes("setting") || value.includes("navigation") || value.includes("footer")) return "settings";
  if (value.includes("team") || value.includes("session") || value.includes("security") || value.includes("password") || value.includes("mfa") || value.includes("account")) return "team";
  return "system";
}

function allowedForModule(module: string, session: Parameters<typeof hasAdminPermission>[0]) {
  if (hasAdminPermission(session, "audit.read")) return true;
  if (module === "crm") return hasAdminPermission(session, "crm.read");
  if (module === "support") return hasAdminPermission(session, "support.read");
  if (module === "appointments") return hasAdminPermission(session, "appointments.read");
  if (module === "marketing") return hasAdminPermission(session, "marketing.read");
  if (module === "site") return hasAdminPermission(session, "site.read");
  if (module === "content") return hasAdminPermission(session, "content.read");
  if (module === "seo") return hasAdminPermission(session, "seo.read");
  if (module === "settings") return hasAdminPermission(session, "settings.read");
  if (module === "team") return hasAdminPermission(session, "team.manage");
  return false;
}

function hrefFor(module: string, row: AuditRow) {
  if (row.action.includes("automation")) return "/admin/automatisations";
  if (row.action.includes("retention")) return "/admin/customer-success/retention";
  if (row.action.includes("success_plan") || row.action.includes("qbr") || row.entity_type === "crm_success_plan" || row.entity_type === "crm_success_objective" || row.entity_type === "crm_qbr" || row.entity_type === "crm_qbr_action") return "/admin/customer-success/plans";
  if (row.action.includes("customer_success") || row.action.includes("customer_review") || row.action.includes("nps_") || row.entity_type === "crm_client_growth") return row.entity_id ? `/admin/customer-success?client=${row.entity_id}` : "/admin/customer-success";
  if (module === "crm") return row.entity_id ? `/admin/crm?lead=${row.entity_id}` : "/admin/crm";
  if (module === "support") return row.entity_id ? `/admin/service-client?ticket=${row.entity_id}` : "/admin/service-client";
  if (module === "appointments") return "/admin/rendez-vous";
  if (module === "marketing") return row.action.includes("newsletter") ? "/admin/newsletters" : "/admin/marketing";
  if (module === "site") return "/admin/pages";
  if (module === "content") return row.entity_type === "article" ? "/admin/articles" : row.entity_type === "resource" ? "/admin/ressources" : "/admin/medias";
  if (module === "seo") return "/admin/seo";
  if (module === "settings") return "/admin/parametres";
  if (module === "team") return "/admin/equipe";
  return "/admin";
}

export async function GET(request: Request) {
  const { error, supabase, session } = requireAdmin(request);
  if (error || !supabase || !session) return error;

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 80), 1), 200);
  const moduleFilter = url.searchParams.get("module")?.trim().toLowerCase() || "";

  const { data, error: queryError } = await supabase
    .from("control_center_audit_logs")
    .select("id,created_at,actor_name,actor_email,actor_role,action,entity_type,entity_id,summary,metadata")
    .order("created_at", { ascending: false })
    .limit(250);

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });

  const items = ((data ?? []) as AuditRow[])
    .map((row) => {
      const module = moduleFor(row.action, row.entity_type);
      return {
        id: row.id,
        createdAt: row.created_at,
        actor: row.actor_name || row.actor_email || "Control Center",
        actorRole: row.actor_role,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        summary: row.summary || row.action,
        module,
        href: hrefFor(module, row),
      };
    })
    .filter((item) => allowedForModule(item.module, session))
    .filter((item) => !moduleFilter || item.module === moduleFilter)
    .slice(0, limit);

  return NextResponse.json({ items });
}
