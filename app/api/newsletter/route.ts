import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function text(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "La newsletter n’est pas encore reliée à la base de données." }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }

  const website = text(body.website, 200);
  if (website) return NextResponse.json({ ok: true });

  const email = text(body.email).toLowerCase();
  const firstName = text(body.firstName, 120);
  const source = text(body.source, 120) || "website";
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Merci de renseigner une adresse e-mail valide." }, { status: 422 });

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
    return NextResponse.json({ error: "Inscription impossible pour le moment." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
