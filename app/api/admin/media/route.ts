import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

const BUCKET="website-media";
const MAX_SIZE=15*1024*1024;
const allowed=new Set(["image/jpeg","image/png","image/webp","image/gif","image/avif","image/svg+xml","application/pdf"]);
function cleanName(name:string){return name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").toLowerCase()||"media"}
function text(value:unknown,max=300){return typeof value==="string"?value.trim().slice(0,max):""}

export async function GET(request:Request){
 const {error,supabase}=requireAdmin(request);if(error||!supabase)return error;
 const url=new URL(request.url);const q=text(url.searchParams.get("q"),120);const folder=text(url.searchParams.get("folder"),80);
 let query=supabase.from("website_media").select("id,created_at,updated_at,file_name,storage_path,public_url,mime_type,file_size,alt_text,folder,metadata").order("created_at",{ascending:false}).limit(200);
 if(folder&&folder!=="all")query=query.eq("folder",folder);if(q)query=query.or(`file_name.ilike.%${q.replace(/[%_]/g,"")}%,alt_text.ilike.%${q.replace(/[%_]/g,"")}%`);
 const {data,error:queryError}=await query;if(queryError)return NextResponse.json({error:queryError.message},{status:500});return NextResponse.json({media:data??[]});
}

export async function POST(request:Request){
 const {error,supabase}=requireAdmin(request);if(error||!supabase)return error;
 let form:FormData;try{form=await request.formData()}catch{return NextResponse.json({error:"Fichier invalide."},{status:400})}
 const file=form.get("file");if(!(file instanceof File))return NextResponse.json({error:"Aucun fichier fourni."},{status:422});if(file.size>MAX_SIZE)return NextResponse.json({error:"Le fichier dépasse 15 Mo."},{status:413});if(!allowed.has(file.type))return NextResponse.json({error:"Format non autorisé."},{status:415});
 const folder=cleanName(text(form.get("folder"),80)||"general");const altText=text(form.get("altText"),300);const safeName=cleanName(file.name);const path=`${folder}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${safeName}`;
 const bytes=await file.arrayBuffer();const {error:uploadError}=await supabase.storage.from(BUCKET).upload(path,bytes,{contentType:file.type,upsert:false,cacheControl:"31536000"});if(uploadError)return NextResponse.json({error:uploadError.message},{status:500});
 const {data:publicData}=supabase.storage.from(BUCKET).getPublicUrl(path);const publicUrl=publicData.publicUrl;
 const {data,error:insertError}=await supabase.from("website_media").insert({file_name:file.name,storage_path:path,public_url:publicUrl,mime_type:file.type,file_size:file.size,alt_text:altText||null,folder}).select().single();
 if(insertError){await supabase.storage.from(BUCKET).remove([path]);return NextResponse.json({error:insertError.message},{status:500})}return NextResponse.json({media:data},{status:201});
}

export async function PATCH(request:Request){
 const {error,supabase}=requireAdmin(request);if(error||!supabase)return error;let body:Record<string,unknown>;try{body=await request.json()}catch{return NextResponse.json({error:"Requête invalide."},{status:400})}
 const id=text(body.id,80);if(!id)return NextResponse.json({error:"ID manquant."},{status:422});const patch:Record<string,unknown>={updated_at:new Date().toISOString()};if("altText" in body)patch.alt_text=text(body.altText,300)||null;if("folder" in body)patch.folder=cleanName(text(body.folder,80)||"general");
 const {data,error:queryError}=await supabase.from("website_media").update(patch).eq("id",id).select().single();if(queryError)return NextResponse.json({error:queryError.message},{status:500});return NextResponse.json({media:data});
}

export async function DELETE(request:Request){
 const {error,supabase}=requireAdmin(request);if(error||!supabase)return error;const id=text(new URL(request.url).searchParams.get("id"),80);if(!id)return NextResponse.json({error:"ID manquant."},{status:422});
 const {data,error:readError}=await supabase.from("website_media").select("storage_path").eq("id",id).maybeSingle();if(readError)return NextResponse.json({error:readError.message},{status:500});if(!data)return NextResponse.json({error:"Média introuvable."},{status:404});
 const {error:removeError}=await supabase.storage.from(BUCKET).remove([data.storage_path]);if(removeError)return NextResponse.json({error:removeError.message},{status:500});const {error:deleteError}=await supabase.from("website_media").delete().eq("id",id);if(deleteError)return NextResponse.json({error:deleteError.message},{status:500});return NextResponse.json({ok:true});
}
