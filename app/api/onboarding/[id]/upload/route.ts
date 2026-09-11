import { NextResponse } from "next/server";
import { authorizeOnboardingPortal, loadOnboardingPortalDocument, ONBOARDING_DOCUMENT_BUCKET } from "@/lib/crm-onboarding-portal";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_SIZE=15*1024*1024;
const ALLOWED=new Set(["application/pdf","image/jpeg","image/png","image/webp","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
function json(data:unknown,status=200){const response=NextResponse.json(data,{status});response.headers.set("Cache-Control","no-store, max-age=0");response.headers.set("Referrer-Policy","no-referrer");response.headers.set("X-Robots-Tag","noindex, nofollow");return response}
function clean(value:unknown,max=240){return typeof value==="string"?value.trim().slice(0,max):""}
function cleanName(name:string){return name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").toLowerCase()||"document"}
async function notify(supabase:any,id:string,title:string,subtitle:string){for(const role of ["founder","admin","sales"]){await supabase.from("control_center_generated_notifications").insert({target_role:role,title,subtitle,href:`/admin/onboarding?case=${id}`,severity:"info",source_type:"crm_onboarding",source_id:`${id}:${title}`})}}
async function ensureBucket(supabase:any){
  const existing=await supabase.storage.getBucket(ONBOARDING_DOCUMENT_BUCKET);if(!existing.error)return null;
  const created=await supabase.storage.createBucket(ONBOARDING_DOCUMENT_BUCKET,{public:false,fileSizeLimit:MAX_SIZE,allowedMimeTypes:[...ALLOWED]});
  if(created.error&&!/already exists|duplicate/i.test(created.error.message||""))return created.error.message||"Stockage privé indisponible.";
  return null;
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const supabase=getSupabaseAdmin();if(!supabase)return json({error:"Service indisponible."},503);
  const {id}=await params;const token=new URL(request.url).searchParams.get("token")||"";
  const authorized=await authorizeOnboardingPortal(supabase,id,token);if(!authorized)return json({error:"Lien invalide ou révoqué."},404);
  let form:FormData;try{form=await request.formData()}catch{return json({error:"Envoi de fichier invalide."},400)}
  const documentId=clean(form.get("documentId"),80);const submittedBy=clean(form.get("name"),240)||"Client";const submittedEmail=clean(form.get("email"),240)||null;const file=form.get("file");
  if(!documentId||!(file instanceof File))return json({error:"Document et fichier obligatoires."},422);
  if(file.size<=0||file.size>MAX_SIZE)return json({error:"Le fichier doit faire moins de 15 Mo."},413);
  if(!ALLOWED.has(file.type))return json({error:"Format autorisé : PDF, JPG, PNG, WEBP ou DOCX."},415);
  if(submittedEmail&&!/^\S+@\S+\.\S+$/.test(submittedEmail))return json({error:"Adresse e-mail invalide."},422);
  const requirement=await supabase.from("website_crm_onboarding_documents").select("id,name,status,client_visible").eq("id",documentId).eq("onboarding_id",id).maybeSingle();
  if(requirement.error||!requirement.data||!requirement.data.client_visible)return json({error:"Document demandé introuvable."},404);
  if(["validated","not_applicable"].includes(String(requirement.data.status)))return json({error:"Ce document est déjà finalisé. Contactez l’équipe MOONY pour le remplacer."},409);
  const bucketError=await ensureBucket(supabase);if(bucketError)return json({error:bucketError},503);
  const safeName=cleanName(file.name);const path=`${id}/${documentId}/${crypto.randomUUID()}-${safeName}`;const bytes=await file.arrayBuffer();
  const upload=await supabase.storage.from(ONBOARDING_DOCUMENT_BUCKET).upload(path,bytes,{contentType:file.type,upsert:false,cacheControl:"3600"});if(upload.error)return json({error:"Impossible de stocker le document."},500);
  const inserted=await supabase.from("website_crm_onboarding_submissions").insert({onboarding_id:id,document_id:documentId,original_name:file.name,storage_path:path,mime_type:file.type,file_size:file.size,status:"received",submitted_by:submittedBy,submitted_email:submittedEmail}).select("id").single();
  if(inserted.error){await supabase.storage.from(ONBOARDING_DOCUMENT_BUCKET).remove([path]);return json({error:"Impossible d’enregistrer le document."},500)}
  const now=new Date().toISOString();await supabase.from("website_crm_onboarding_documents").update({status:"received",document_url:`storage://${ONBOARDING_DOCUMENT_BUCKET}/${path}`,updated_at:now}).eq("id",documentId);
  await supabase.from("website_crm_onboarding_events").insert({onboarding_id:id,event_type:"client_document_uploaded",title:"Document reçu du client",detail:`${requirement.data.name} · ${file.name}`,actor:submittedBy});
  await notify(supabase,id,"Document onboarding reçu",`${requirement.data.name} · ${file.name}`);
  const document=await loadOnboardingPortalDocument(supabase,id);return json({ok:true,submissionId:inserted.data.id,document},{status:201});
}
