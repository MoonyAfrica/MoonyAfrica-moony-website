import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { ONBOARDING_DOCUMENT_BUCKET } from "@/lib/crm-onboarding-portal";

export async function GET(request:Request,{params}:{params:Promise<{documentId:string}>}){
  const {error,supabase}=requireAdmin(request,"crm.read");if(error||!supabase)return error;
  const {documentId}=await params;
  const row=await supabase.from("website_crm_onboarding_submissions").select("storage_path,original_name").eq("document_id",documentId).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(row.error){if(row.error.code==="42P01")return NextResponse.json({error:"Appliquez la migration CRM V7.1 pour accéder aux fichiers clients."},{status:409});return NextResponse.json({error:row.error.message},{status:500})}
  if(!row.data)return NextResponse.json({error:"Aucun fichier client pour ce document."},{status:404});
  const signed=await supabase.storage.from(ONBOARDING_DOCUMENT_BUCKET).createSignedUrl(row.data.storage_path,300,{download:row.data.original_name});
  if(signed.error||!signed.data?.signedUrl)return NextResponse.json({error:"Fichier privé indisponible."},{status:404});
  return NextResponse.redirect(signed.data.signedUrl,302);
}
