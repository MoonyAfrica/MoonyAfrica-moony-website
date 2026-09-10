import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] ?? char));
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "support.write");
  if (error || !supabase) return error;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const ticketId = asText(body.ticketId, 80);
  const reply = asText(body.message, 5000);
  const senderName = session?.name || asText(body.senderName, 180) || "Équipe MOONY";
  if (!ticketId || !reply) return NextResponse.json({ error: "Ticket et réponse obligatoires." }, { status: 422 });

  const { data: ticket, error: ticketError } = await supabase.from("support_tickets").select("id,requester_name,requester_email,subject").eq("id", ticketId).single();
  if (ticketError || !ticket) return NextResponse.json({ error: ticketError?.message || "Ticket introuvable." }, { status: 404 });

  const now = new Date().toISOString();
  const { data: message, error: insertError } = await supabase.from("support_ticket_messages").insert({ ticket_id: ticketId, sender_kind: "agent", sender_name: senderName, body: reply }).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase.from("support_tickets").update({ status: "waiting", assigned_to: senderName, updated_at: now }).eq("id", ticketId);

  let delivered = false;
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (apiKey && senderEmail) {
    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey, accept: "application/json" },
      body: JSON.stringify({
        sender: { name: process.env.BREVO_SENDER_NAME || "MOONY Africa", email: senderEmail },
        to: [{ email: ticket.requester_email, name: ticket.requester_name || undefined }],
        subject: `Re: ${ticket.subject}`,
        htmlContent: `<div style="font-family:Arial,sans-serif;color:#5b2f22;line-height:1.7"><p>Bonjour${ticket.requester_name ? ` ${escapeHtml(ticket.requester_name)}` : ""},</p><p>${escapeHtml(reply).replace(/\n/g, "<br>")}</p><p>— ${escapeHtml(senderName)}<br>MOONY Africa</p></div>`,
      }),
    });
    delivered = emailResponse.ok;
  }

  await writeAuditLog(supabase, session, "support.reply_sent", "support_ticket", ticketId, `Réponse envoyée sur « ${ticket.subject} »`, { messageId: message.id, delivered });
  return NextResponse.json({ message, delivered });
}
