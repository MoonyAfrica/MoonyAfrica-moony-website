import type { MetadataRoute } from "next";
import { getPublicSiteSettings, safePublicUrl } from "@/lib/public-settings";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const revalidate = 3600;

type SitemapEntry = MetadataRoute.Sitemap[number];

function joinUrl(base: string, path: string) {
  return `${base}${path === "/" ? "" : path.startsWith("/") ? path : `/${path}`}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { general, seo } = await getPublicSiteSettings();
  const base = safePublicUrl(general.publicUrl);
  if (!seo.allowIndexing) return [];

  const entries = new Map<string, SitemapEntry>();
  const add = (path: string, data: Omit<SitemapEntry, "url"> = {}) => {
    const url = joinUrl(base, path);
    entries.set(url, { url, ...data });
  };

  add("/", { changeFrequency: "weekly", priority: 1 });
  ["/notre-mission", "/notre-approche", "/a-propos", "/services", "/communaute", "/ressources", "/contact"].forEach((path) =>
    add(path, { changeFrequency: "monthly", priority: path === "/services" ? 0.9 : 0.7 }),
  );

  const supabase = getSupabaseAdmin();
  if (!supabase) return Array.from(entries.values());

  try {
    const [pagesResult, articlesResult, resourcesResult] = await Promise.all([
      supabase.from("website_pages").select("slug,updated_at").eq("status", "published"),
      supabase.from("website_articles").select("slug,updated_at,published_at").eq("status", "published"),
      supabase.from("website_resources").select("slug,updated_at").eq("status", "published"),
    ]);

    for (const page of pagesResult.data ?? []) {
      if (!page.slug || page.slug.startsWith("/admin")) continue;
      add(page.slug, { lastModified: page.updated_at ? new Date(page.updated_at) : undefined, changeFrequency: "monthly", priority: page.slug === "/" ? 1 : 0.7 });
    }
    for (const article of articlesResult.data ?? []) {
      if (!article.slug) continue;
      add(`/journal/${article.slug}`, { lastModified: article.updated_at || article.published_at ? new Date(article.updated_at || article.published_at) : undefined, changeFrequency: "monthly", priority: 0.65 });
    }
    for (const resource of resourcesResult.data ?? []) {
      if (!resource.slug) continue;
      add(`/ressources/${resource.slug}`, { lastModified: resource.updated_at ? new Date(resource.updated_at) : undefined, changeFrequency: "monthly", priority: 0.65 });
    }
  } catch {
    // Le sitemap public reste disponible avec les routes essentielles si Supabase est momentanément indisponible.
  }

  return Array.from(entries.values());
}
