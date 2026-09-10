import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.redirect(new URL("/ressources", _request.url));
  const { data } = await supabase.from("website_resources").select("id,file_url,downloads").eq("status","published").eq("slug",slug).maybeSingle();
  if (!data?.file_url) return NextResponse.redirect(new URL(`/ressources/${slug}`, _request.url));
  await supabase.from("website_resources").update({ downloads: Number(data.downloads || 0) + 1, updated_at: new Date().toISOString() }).eq("id",data.id);
  return NextResponse.redirect(data.file_url);
}
