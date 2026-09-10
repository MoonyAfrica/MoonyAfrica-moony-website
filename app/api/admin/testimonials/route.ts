import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";

const statuses = new Set(["pending","approved","rejected"]);
const json = async (request: Request) => { try { return await request.json() as Record<string, unknown>; } catch { return null; } };

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request,"content.read"); if (error || !supabase) return error;
  const { data, error: queryError } = await supabase.from("website_testimonials").select("*").order("created_at", { ascending: false });
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ testimonials: data ?? [] });
}

export async function POST(request: Request) {
  const { error, supabase, session } = requireAdmin(request,"content.write"); if (error || !supabase) return error;
  const input = await json(request); if (!input) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const authorName = asText(input.authorName, 180); const quote = asText(input.quote, 1800);
  if (!authorName || !quote) return NextResponse.json({ error: "Le nom et le témoignage sont obligatoires." }, { status: 422 });
  const { data, error: insertError } = await supabase.from("website_testimonials").insert({
    author_name: authorName,
    author_location: asNullableText(input.authorLocation, 220),
    author_role: asNullableText(input.authorRole, 180),
    quote,
    rating: Math.min(5, Math.max(1, Number(input.rating) || 5)),
    status: statuses.has(asText(input.status, 30)) ? asText(input.status, 30) : "pending",
    featured: Boolean(input.featured),
    consent_to_publish: Boolean(input.consentToPublish),
    updated_at: new Date().toISOString(),
  }).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  await writeAuditLog(supabase,session,"brand.testimonial_created","testimonial",data.id,`Témoignage de ${data.author_name} créé`,{status:data.status,featured:data.featured,consent:data.consent_to_publish});
  return NextResponse.json({ testimonial: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request,"content.write"); if (error || !supabase) return error;
  const input = await json(request); if (!input) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const id = asText(input.id, 80); if (!id) return NextResponse.json({ error: "Témoignage introuvable." }, { status: 422 });
  const {data:before}=await supabase.from("website_testimonials").select("author_name,status,featured,consent_to_publish").eq("id",id).maybeSingle();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("authorName" in input) patch.author_name = asText(input.authorName, 180);
  if ("authorLocation" in input) patch.author_location = asNullableText(input.authorLocation, 220);
  if ("authorRole" in input) patch.author_role = asNullableText(input.authorRole, 180);
  if ("quote" in input) patch.quote = asText(input.quote, 1800);
  if ("rating" in input) patch.rating = Math.min(5, Math.max(1, Number(input.rating) || 5));
  if (statuses.has(asText(input.status, 30))) patch.status = asText(input.status, 30);
  if ("featured" in input) patch.featured = Boolean(input.featured);
  if ("consentToPublish" in input) patch.consent_to_publish = Boolean(input.consentToPublish);
  const { data, error: updateError } = await supabase.from("website_testimonials").update(patch).eq("id", id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await writeAuditLog(supabase,session,"brand.testimonial_updated","testimonial",id,`Témoignage de ${data.author_name} modifié`,{previousStatus:before?.status??null,status:data.status,featured:data.featured,consent:data.consent_to_publish});
  return NextResponse.json({ testimonial: data });
}

export async function DELETE(request: Request) {
  const { error, supabase, session } = requireAdmin(request,"content.write"); if (error || !supabase) return error;
  const id = new URL(request.url).searchParams.get("id") || ""; if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });
  const {data:before}=await supabase.from("website_testimonials").select("author_name,status").eq("id",id).maybeSingle();
  const { error: deleteError } = await supabase.from("website_testimonials").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  await writeAuditLog(supabase,session,"brand.testimonial_deleted","testimonial",id,before?`Témoignage de ${before.author_name} supprimé`:"Témoignage supprimé",{status:before?.status??null});
  return NextResponse.json({ ok: true });
}
