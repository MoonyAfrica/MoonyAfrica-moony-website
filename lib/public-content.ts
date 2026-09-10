import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type PublicArticle = { id:string; title:string; slug:string; category:string; excerpt:string|null; content:string; image_url:string|null; featured:boolean; published_at:string|null; seo_title:string|null; seo_description:string|null; author_name:string };
export type PublicResource = { id:string; title:string; slug:string; resource_type:string; category:string; excerpt:string|null; content:string|null; image_url:string|null; file_url:string|null; featured:boolean; downloads:number };
export type PublicTestimonial = { id:string; author_name:string; author_location:string|null; author_role:string|null; quote:string; rating:number|null; featured:boolean };
export type PublicPartner = { id:string; name:string; category:string|null; country:string|null; website_url:string|null; logo_url:string|null; short_description:string|null; featured:boolean };

export async function getPublishedArticles(limit=20): Promise<PublicArticle[]> {
  const supabase=getSupabaseAdmin(); if(!supabase)return[];
  const {data}=await supabase.from("website_articles").select("id,title,slug,category,excerpt,content,image_url,featured,published_at,seo_title,seo_description,author_name").eq("status","published").order("featured",{ascending:false}).order("published_at",{ascending:false}).limit(limit);
  return (data??[]) as PublicArticle[];
}

export async function getArticleBySlug(slug:string): Promise<PublicArticle|null> {
  const supabase=getSupabaseAdmin(); if(!supabase)return null;
  const {data}=await supabase.from("website_articles").select("id,title,slug,category,excerpt,content,image_url,featured,published_at,seo_title,seo_description,author_name").eq("status","published").eq("slug",slug).maybeSingle();
  return data as PublicArticle|null;
}

export async function getPublishedResources(limit=30): Promise<PublicResource[]> {
  const supabase=getSupabaseAdmin(); if(!supabase)return[];
  const {data}=await supabase.from("website_resources").select("id,title,slug,resource_type,category,excerpt,content,image_url,file_url,featured,downloads").eq("status","published").order("featured",{ascending:false}).order("sort_order").order("updated_at",{ascending:false}).limit(limit);
  return (data??[]) as PublicResource[];
}

export async function getResourceBySlug(slug:string): Promise<PublicResource|null> {
  const supabase=getSupabaseAdmin(); if(!supabase)return null;
  const {data}=await supabase.from("website_resources").select("id,title,slug,resource_type,category,excerpt,content,image_url,file_url,featured,downloads").eq("status","published").eq("slug",slug).maybeSingle();
  return data as PublicResource|null;
}

export async function getFeaturedTestimonials(limit=6): Promise<PublicTestimonial[]> {
  const supabase=getSupabaseAdmin(); if(!supabase)return[];
  const {data}=await supabase.from("website_testimonials").select("id,author_name,author_location,author_role,quote,rating,featured").eq("status","approved").eq("consent_to_publish",true).order("featured",{ascending:false}).order("created_at",{ascending:false}).limit(limit);
  return (data??[]) as PublicTestimonial[];
}

export async function getPublishedPartners(limit=12): Promise<PublicPartner[]> {
  const supabase=getSupabaseAdmin(); if(!supabase)return[];
  const {data}=await supabase.from("website_partners").select("id,name,category,country,website_url,logo_url,short_description,featured").eq("status","published").order("featured",{ascending:false}).order("sort_order").limit(limit);
  return (data??[]) as PublicPartner[];
}
