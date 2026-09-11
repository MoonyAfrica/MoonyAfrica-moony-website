import { NextResponse } from "next/server";
import { triggerAutomationEvent } from "@/lib/automation-engine";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const allowedNeeds = new Set([
  "demonstration",
  "rappel",
  "professionnel",
  "partenariat",
  "entreprise",
  "presse",
  "carriere",
  "confidentialite",
  "protections",
  "legal",
  "autre",
]);

function asText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Le formulaire n’est pas encore relié à la base de données." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const firstName = asText(body.firstName, 120);
  const lastName = asText(body.lastName, 120);
  const email = asText(body.email, 240).toLowerCase();
  const phone = asText(body.phone, 80);
  const company = asText(body.company, 180);
  const roleTitle = asText(body.roleTitle, 180);
  const requestedNeed = asText(body.need, 80).toLowerCase();
  const need = allowedNeeds.has(requestedNeed) ? requestedNeed : "autre";
  const message = asText(body.message, 4000);
  const website = asText(body.website, 200);

  if (website) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (!firstName || !lastName || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Merci de renseigner votre prénom, votre nom et un e-mail valide." }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("website_leads")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      company: company || null,
      role_title: roleTitle || null,
      need,
      message: message || null,
      source: "website-contact-form",
      metadata: {
        user_agent: request.headers.get("user-agent"),
        referer: request.headers.get("referer"),
      },
    })
    .select("id,status,assigned_to,country,need,source,deal_value")
    .single();

  if (error) {
    console.error("MOONY lead insert failed", error);
    return NextResponse.json({ error: "Impossible d’enregistrer votre demande pour le moment." }, { status: 500 });
  }

  try {
    await triggerAutomationEvent(supabase, "new_lead", "lead", data.id, {
      lead_id: data.id,
      lead: company || `${firstName} ${lastName}`,
      first_name: firstName,
      last_name: lastName,
      company,
      email,
      status: data.status || "new",
      assigned_to: data.assigned_to,
      country: data.country,
      need: data.need || need,
      source: data.source || "website-contact-form",
      deal_value: data.deal_value,
    });
  } catch {
    // A lead must never be lost because a non-critical automation could not run.
  }

  return NextResponse.json({ ok: true, leadId: data.id }, { status: 201 });
}
