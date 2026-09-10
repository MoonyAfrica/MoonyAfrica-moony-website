import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ elements: [] });

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("marketing_elements")
    .select("id,name,kind,placement,eyebrow,headline,body,cta_label,cta_url,collect_email,start_at,end_at,config")
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("MOONY public marketing fetch failed", error);
    return NextResponse.json({ elements: [] });
  }

  const elements = (data ?? []).filter((item) => (!item.start_at || item.start_at <= now) && (!item.end_at || item.end_at >= now));
  return NextResponse.json({ elements }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
