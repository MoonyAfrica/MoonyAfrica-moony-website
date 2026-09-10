import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type CmsHero = {
  eyebrow?: string;
  title?: string;
  body?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export type PublishedPage = {
  id: string;
  title: string;
  slug: string;
  seo_title: string | null;
  seo_description: string | null;
  hero: CmsHero;
  sections: unknown[];
  updated_at: string;
};

export async function getPublishedPage(slug: string): Promise<PublishedPage | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("website_pages")
      .select("id,title,slug,seo_title,seo_description,hero,sections,updated_at")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error(`MOONY CMS read failed for ${slug}`, error);
      return null;
    }
    return data as PublishedPage | null;
  } catch (error) {
    console.error(`MOONY CMS unavailable for ${slug}`, error);
    return null;
  }
}

export function heroLines(value: string | undefined, fallback: string[]) {
  const source = value?.trim() ? value.split("\n").map((line) => line.trim()).filter(Boolean) : fallback;
  return source;
}
