import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function text(value: unknown, max = 500) { return typeof value === "string" ? value.trim().slice(0,max) : ""; }

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Le formulaire n’est pas encore relié à la base de données." }, { status: 503 });
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  if (text(body.website,200)) return NextResponse.json({ ok:true });
  const authorName=text(body.authorName,180); const quote=text(body.quote,1800); const email=text(body.email,240).toLowerCase();
  if(!authorName||!quote||!email.includes("@")) return NextResponse.json({ error:"Merci de renseigner votre nom, votre e-mail et votre témoignage." },{status:422});
  if(!body.consentToPublish) return NextResponse.json({ error:"Merci de confirmer que MOONY peut examiner votre témoignage en vue d’une publication." },{status:422});
  const rating=Math.min(5,Math.max(1,Number(body.rating)||5));
  const {error}=await supabase.from("website_testimonials").insert({
    author_name:authorName,
    author_location:text(body.authorLocation,220)||null,
    author_role:text(body.authorRole,180)||null,
    quote,
    rating,
    status:"pending",
    featured:false,
    consent_to_publish:true,
    metadata:{ requester_email:email, source:"public-testimonial-form", referer:request.headers.get("referer") },
  });
  if(error){console.error("MOONY testimonial insert failed",error);return NextResponse.json({error:"Impossible d’enregistrer votre témoignage pour le moment."},{status:500});}
  return NextResponse.json({ok:true},{status:201});
}
