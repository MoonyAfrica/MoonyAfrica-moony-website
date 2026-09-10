import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] ?? char));
}

function campaignHtml(content: Record<string, unknown>) {
  if (typeof content.html === "string" && content.html.trim()) return content.html;
  const headline = escapeHtml(typeof content.headline === "string" ? content.headline : "Des femmes plus sereines, pour un monde plus lumineux.");
  const body = escapeHtml(typeof content.body === "string" ? content.body : "Découvrez les dernières ressources et actualités de MOONY Africa.");
  const ctaLabel = escapeHtml(typeof content.ctaLabel === "string" ? content.ctaLabel : "Découvrir MOONY");
  const rawUrl = typeof content.ctaUrl === "string" ? content.ctaUrl : "https://www.moonyafrica.com";
  const ctaUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : "https://www.moonyafrica.com";
  return `<!doctype html><html><body style="margin:0;background:#f8f0e5;font-family:Arial,sans-serif;color:#5b2f22"><div style="max-width:640px;margin:0 auto;padding:34px 20px"><div style="font-family:Georgia,serif;font-size:28px;letter-spacing:.08em;margin-bottom:28px">MOONY</div><div style="background:#fffaf4;border-radius:24px;padding:42px 34px"><h1 style="font-family:Georgia,serif;font-weight:400;font-size:42px;line-height:1.04;margin:0 0 20px">${headline}</h1><p style="font-size:16px;line-height:1.7;color:#765245;margin:0 0 28px">${body}</p><a href="${ctaUrl}" style="display:inline-block;background:#7e3518;color:white;text-decoration:none;border-radius:999px;padding:14px 24px;font-weight:600">${ctaLabel}</a></div><p style="font-size:11px;line-height:1.6;color:#9a7b6e;margin-top:22px">Vous recevez cet e-mail parce que vous vous êtes inscrite aux communications de MOONY Africa.</p></div></body></html>`;
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "marketing.write");
  if (error || !supabase) return error;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const id = asText(body.id, 80);
  if (!id) return NextResponse.json({ error: "Campagne manquante." }, { status: 422 });

  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_LIST_ID || "");
  const defaultSenderEmail = process.env.BREVO_SENDER_EMAIL;
  const defaultSenderName = process.env.BREVO_SENDER_NAME || "MOONY Africa";
  if (!apiKey || !Number.isFinite(listId) || !listId || !defaultSenderEmail) {
    return NextResponse.json({ error: "Brevo n’est pas encore configuré. Ajoutez BREVO_API_KEY, BREVO_LIST_ID et BREVO_SENDER_EMAIL." }, { status: 503 });
  }

  const { data: campaign, error: campaignError } = await supabase.from("newsletter_campaigns").select("*").eq("id", id).single();
  if (campaignError || !campaign) return NextResponse.json({ error: campaignError?.message || "Campagne introuvable." }, { status: 404 });
  if (campaign.status === "sent") return NextResponse.json({ error: "Cette campagne a déjà été envoyée." }, { status: 409 });

  const createResponse = await fetch("https://api.brevo.com/v3/emailCampaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey, accept: "application/json" },
    body: JSON.stringify({
      name: campaign.name,
      subject: campaign.subject,
      sender: { name: campaign.sender_name || defaultSenderName, email: campaign.sender_email || defaultSenderEmail },
      type: "classic",
      htmlContent: campaignHtml((campaign.content ?? {}) as Record<string, unknown>),
      recipients: { listIds: [listId] },
    }),
  });

  const created = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok || !created.id) {
    return NextResponse.json({ error: created.message || "Brevo n’a pas pu créer la campagne." }, { status: 502 });
  }

  const sendResponse = await fetch(`https://api.brevo.com/v3/emailCampaigns/${created.id}/sendNow`, {
    method: "POST",
    headers: { "api-key": apiKey, accept: "application/json" },
  });
  if (!sendResponse.ok) {
    const sendError = await sendResponse.json().catch(() => ({}));
    await supabase.from("newsletter_campaigns").update({ provider: "brevo", provider_campaign_id: String(created.id), status: "paused", updated_at: new Date().toISOString() }).eq("id", id);
    await writeAuditLog(supabase, session, "newsletter.send_failed", "newsletter_campaign", id, `Envoi échoué pour « ${campaign.name} »`, { provider:"brevo", providerCampaignId:String(created.id) });
    return NextResponse.json({ error: sendError.message || "Campagne créée dans Brevo mais envoi non déclenché." }, { status: 502 });
  }

  const now = new Date().toISOString();
  const { data: saved, error: updateError } = await supabase.from("newsletter_campaigns").update({ provider: "brevo", provider_campaign_id: String(created.id), status: "sent", sent_at: now, updated_at: now }).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await writeAuditLog(supabase, session, "newsletter.sent", "newsletter_campaign", id, `Newsletter « ${campaign.name} » envoyée`, { provider:"brevo", providerCampaignId:String(created.id), audience:campaign.audience });
  return NextResponse.json({ ok: true, campaign: saved });
}
