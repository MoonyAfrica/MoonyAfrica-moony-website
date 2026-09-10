import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function text(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function syncToBrevo(email: string, firstName: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_LIST_ID || "");
  if (!apiKey || !Number.isFinite(listId) || !listId) return false;

  try {
    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey, accept: "application/json" },
      body: JSON.stringify({
        email,
        attributes: firstName ? { FIRSTNAME: firstName } : undefined,
        listIds: [listId],
        updateEnabled: true,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("MOONY Brevo contact sync failed", response.status, detail.slice(0, 500));
      return false;
    }
    return true;
  } catch (error) {
    console.error("MOONY Brevo contact sync failed", error);
    return false;
  }
}

function redirectBack(request: Request, state: "ok" | "error") {
  const referer = request.headers.get("referer");
  const target = new URL(referer || "/", request.url);
  target.searchParams.set("newsletter", state);
  return NextResponse.redirect(target, 303);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const htmlForm = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
  const supabase = getSupabaseAdmin();
  if (!supabase) return htmlForm ? redirectBack(request, "error") : NextResponse.json({ error: "La newsletter n’est pas encore reliée à la base de données." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    if (htmlForm) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    } else {
      body = await request.json();
    }
  } catch {
    return htmlForm ? redirectBack(request, "error") : NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const website = text(body.website, 200);
  if (website) return htmlForm ? redirectBack(request, "ok") : NextResponse.json({ ok: true });

  const email = text(body.email).toLowerCase();
  const firstName = text(body.firstName, 120);
  const source = text(body.source, 120) || "website";
  if (!email || !email.includes("@")) return htmlForm ? redirectBack(request, "error") : NextResponse.json({ error: "Merci de renseigner une adresse e-mail valide." }, { status: 422 });

  const { error } = await supabase.from("newsletter_subscribers").upsert({
    email,
    first_name: firstName || null,
    source,
    status: "subscribed",
    consent_at: new Date().toISOString(),
    metadata: { referer: request.headers.get("referer"), user_agent: request.headers.get("user-agent") },
  }, { onConflict: "email" });

  if (error) {
    console.error("MOONY newsletter subscription failed", error);
    return htmlForm ? redirectBack(request, "error") : NextResponse.json({ error: "Inscription impossible pour le moment." }, { status: 500 });
  }

  const syncedToBrevo = await syncToBrevo(email, firstName);
  return htmlForm ? redirectBack(request, "ok") : NextResponse.json({ ok: true, syncedToBrevo }, { status: 201 });
}
