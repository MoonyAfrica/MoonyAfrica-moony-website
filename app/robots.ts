import type { MetadataRoute } from "next";
import { getPublicSiteSettings, safePublicUrl } from "@/lib/public-settings";

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { general, seo } = await getPublicSiteSettings();
  const base = safePublicUrl(general.publicUrl);

  return {
    rules: seo.allowIndexing
      ? {
          userAgent: "*",
          allow: "/",
          disallow: ["/admin/", "/api/"],
        }
      : {
          userAgent: "*",
          disallow: "/",
        },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
