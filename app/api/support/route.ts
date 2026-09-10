import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const types = new Set(["question", "request", "incident", "complaint", "feedback"]);

function text(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Le service client n’est pas encore relié à la base de données." }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  if (text(body.website, 200)) return NextResponse.json({ ok: true });

  const requesterName = text(body.name, 180);
  const requesterEmail = text(body.email, 240).toLowerCase();
  const type = types.has(text(body.type, 40)) ? text(body.type, 40) : "question";
  const subject = text(body.subject, 240);
  const message = text(body.message, 5000);
  if (!requesterEmail || !requesterEmail.includes("@") || !subject || !message) {
    return NextResponse.json({ error: "Merci de renseigner votre e-mail, le sujet et votre message." }, { status: 422 });
  }

  const { data, error } = await supabase.from("support_tickets").insert({
    requester_name: requesterName || null,
    requester_email: requesterEmail,
    type,
    subject,
    message,
    priority: "normal",
    status: "open",
    metadata: { source: "website-support-form", referer: request.headers.get("referer"), user_agent: request.headers.get("user-agent") },
  }).select("id").single();

  if (error) {
    console.error("MOONY support ticket insert failed", error);
    return NextResponse.json({ error: "Votre demande n’a pas pu être enregistrée." }, { status: 500 });
  }

  await supabase.from("support_ticket_messages").insert({ ticket_id: data.id, sender_kind: "requester", sender_name: requesterName || null, body: message });
  return NextResponse.json({ ok: true, ticketId: data.id }, { status: 201 });
}
