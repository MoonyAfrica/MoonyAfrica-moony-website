import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import type { AdminSession } from "@/lib/admin-auth";
import { triggerAutomationEvent } from "@/lib/automation-engine";

const statuses = new Set(["new","to_contact","contacted","appointment","proposal","negotiation","won","lost"]);
const needs = new Set(["demonstration","rappel","professionnel","partenariat","entreprise","presse","carriere","confidentialite","protections","legal","autre"]);
const stageLabels: Record<string,string> = {
  new:"Nouveau", to_contact:"À contacter", contacted:"Contacté", appointment:"RDV planifié",
  proposal:"Proposition envoyée", negotiation:"Négociation", won:"Signé", lost:"Perdu",
};
const json = async (request: Request) => { try { return await request.json() as Record<string, unknown>; } catch { return null; } };

async function logActivity(supabase: ReturnType<typeof requireAdmin>["supabase"], leadId:string, summary:string, body:string | null, session:AdminSession|null) {
  if (!supabase) return;
  await supabase.from("website_crm_activities").insert({
    lead_id: leadId,
    kind: "system",
    summary,
    body: body || null,
    created_by: session?.name || session?.email || "Control Center",
  });
}

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request, "crm.read"); if (error || !supabase) return error;
  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() || "";
  let builder = supabase.from("website_leads").select("*").order("updated_at", { ascending: false }).limit(250);
  if (query) builder = builder.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`);
  const { data, error: queryError } = await builder;
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ leads: data ?? [] });
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write"); if (error || !supabase) return error;
  const input = await json(request); if (!input) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const firstName = asText(input.firstName,120); const lastName = asText(input.lastName,120); const email = asText(input.email,240).toLowerCase();
  if (!firstName || !lastName || !email.includes("@")) return NextResponse.json({ error: "Prénom, nom et e-mail valide sont obligatoires." }, { status: 422 });
  const status = statuses.has(asText(input.status,40)) ? asText(input.status,40) : "new";
  const need = needs.has(asText(input.need,80)) ? asText(input.need,80) : "autre";
  const { data, error: insertError } = await supabase.from("website_leads").insert({
    first_name:firstName,last_name:lastName,email,
    phone:asNullableText(input.phone,80),company:asNullableText(input.company,180),role_title:asNullableText(input.roleTitle,180),need,
    message:asNullableText(input.message,4000),source:asText(input.source,120)||"control-center",status,
    assigned_to:asNullableText(input.assignedTo,160),deal_value:Number.isFinite(Number(input.dealValue))?Number(input.dealValue):null,
    country:asNullableText(input.country,120),city:asNullableText(input.city,120),notes:asNullableText(input.notes,8000),updated_at:new Date().toISOString(),
  }).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  await logActivity(supabase, data.id, "Lead créé", `Source : ${data.source || "Control Center"}`, session);
  await writeAuditLog(supabase, session, "crm.lead_created", "lead", data.id, `${firstName} ${lastName} ajouté au CRM`, { status, need, company: data.company ?? null });
  try {
    await triggerAutomationEvent(supabase, "new_lead", "lead", data.id, {
      lead_id: data.id,
      lead: data.company || `${data.first_name} ${data.last_name}`,
      first_name: data.first_name,
      last_name: data.last_name,
      company: data.company,
      email: data.email,
      status: data.status,
      assigned_to: data.assigned_to,
    });
  } catch {}
  return NextResponse.json({ lead:data }, { status:201 });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write"); if (error || !supabase) return error;
  const input = await json(request); if (!input) return NextResponse.json({ error:"Requête invalide." },{status:400});
  const id=asText(input.id,80); if(!id) return NextResponse.json({error:"Lead introuvable."},{status:422});

  const { data: before } = await supabase.from("website_leads").select("first_name,last_name,status,assigned_to,deal_value").eq("id", id).maybeSingle();
  const patch:Record<string,unknown>={updated_at:new Date().toISOString()};
  if("firstName" in input)patch.first_name=asText(input.firstName,120);
  if("lastName" in input)patch.last_name=asText(input.lastName,120);
  if("email" in input)patch.email=asText(input.email,240).toLowerCase();
  if("phone" in input)patch.phone=asNullableText(input.phone,80);
  if("company" in input)patch.company=asNullableText(input.company,180);
  if("roleTitle" in input)patch.role_title=asNullableText(input.roleTitle,180);
  if(needs.has(asText(input.need,80)))patch.need=asText(input.need,80);
  if("message" in input)patch.message=asNullableText(input.message,4000);
  if("source" in input)patch.source=asText(input.source,120)||"control-center";
  if(statuses.has(asText(input.status,40)))patch.status=asText(input.status,40);
  if("assignedTo" in input)patch.assigned_to=asNullableText(input.assignedTo,160);
  if("dealValue" in input)patch.deal_value=Number.isFinite(Number(input.dealValue))?Number(input.dealValue):null;
  if("country" in input)patch.country=asNullableText(input.country,120);
  if("city" in input)patch.city=asNullableText(input.city,120);
  if("notes" in input)patch.notes=asNullableText(input.notes,8000);
  if(input.markContacted===true)patch.last_contacted_at=new Date().toISOString();
  const {data,error:updateError}=await supabase.from("website_leads").update(patch).eq("id",id).select("*").single();
  if(updateError)return NextResponse.json({error:updateError.message},{status:500});

  if (before?.status && before.status !== data.status) {
    await logActivity(supabase, id, "Étape commerciale modifiée", `${stageLabels[before.status] || before.status} → ${stageLabels[data.status] || data.status}`, session);
  }
  if ((before?.assigned_to || null) !== (data.assigned_to || null)) {
    await logActivity(supabase, id, "Responsable commercial modifié", `${before?.assigned_to || "Non assigné"} → ${data.assigned_to || "Non assigné"}`, session);
  }
  if (Number(before?.deal_value || 0) !== Number(data.deal_value || 0)) {
    await logActivity(supabase, id, "Valeur de l’opportunité modifiée", `${Number(before?.deal_value || 0)} → ${Number(data.deal_value || 0)}`, session);
  }
  await writeAuditLog(supabase, session, "crm.lead_updated", "lead", id, `Prospect ${before ? `${before.first_name} ${before.last_name}` : id} modifié`, { previousStatus: before?.status ?? null, status: data.status, assignedTo: data.assigned_to ?? null, dealValue: data.deal_value ?? null });
  return NextResponse.json({lead:data});
}

export async function DELETE(request: Request) {
  const { error, supabase, session }=requireAdmin(request, "crm.write"); if(error||!supabase)return error;
  const id=new URL(request.url).searchParams.get("id")||""; if(!id)return NextResponse.json({error:"Identifiant manquant."},{status:422});
  const { data: before } = await supabase.from("website_leads").select("first_name,last_name,email").eq("id",id).maybeSingle();
  const {error:deleteError}=await supabase.from("website_leads").delete().eq("id",id);
  if(deleteError)return NextResponse.json({error:deleteError.message},{status:500});
  await writeAuditLog(supabase, session, "crm.lead_deleted", "lead", id, before ? `${before.first_name} ${before.last_name} supprimé du CRM` : "Prospect supprimé", { email: before?.email ?? null });
  return NextResponse.json({ok:true});
}
