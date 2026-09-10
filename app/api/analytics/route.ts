import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function text(value: unknown, max = 500) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
const allowedEvents = new Set(["page_view","app_click","cta_click","resource_open","article_open","newsletter_signup","support_submit"]);

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: true, stored: false });
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const eventName = text(body.eventName, 80);
  if (!allowedEvents.has(eventName)) return NextResponse.json({ error: "Événement invalide." }, { status: 422 });
  const visitorId = text(body.visitorId, 120); const sessionId = text(body.sessionId, 120);
  const country = text(request.headers.get("x-vercel-ip-country"), 8) || null;
  const city = text(request.headers.get("x-vercel-ip-city"), 120) || null;
  const referrer = text(body.referrer, 500) || null;
  const source = referrer ? (() => { try { return new URL(referrer).hostname.slice(0, 180); } catch { return "referral"; } })() : "direct";
  const { error } = await supabase.from("website_analytics_events").insert({
    event_name: eventName,
    path: text(body.path, 500) || null,
    visitor_id: visitorId || null,
    session_id: sessionId || null,
    country,
    city,
    device: text(body.device, 30) || null,
    source,
    referrer,
    metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
  });
  if (error) console.error("MOONY analytics insert failed", error);
  return NextResponse.json({ ok: true, stored: !error });
}
