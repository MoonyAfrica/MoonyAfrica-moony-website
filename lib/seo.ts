import type { Metadata } from "next";
import type { PublishedPage } from "@/lib/cms";
import { getPublicSiteSettings } from "@/lib/public-settings";

function formatFallbackTitle(title:string,template:string,organizationName:string){
 const clean=title.trim();
 if(!clean)return organizationName;
 if(organizationName&&clean.toLocaleLowerCase().includes(organizationName.toLocaleLowerCase()))return clean;
 return template.includes("%s")?template.replace("%s",clean):clean;
}

export async function buildCmsMetadata({
  page,
  fallbackTitle,
  fallbackDescription,
  path,
}: {
  page: PublishedPage | null;
  fallbackTitle: string;
  fallbackDescription: string;
  path: string;
}): Promise<Metadata> {
  const { seo } = await getPublicSiteSettings();
  const custom = page?.metadata ?? {};
  const title = page?.seo_title || formatFallbackTitle(fallbackTitle,seo.titleTemplate,seo.organizationName);
  const description = page?.seo_description || page?.hero?.body || fallbackDescription;
  const socialTitle = custom.ogTitle?.trim() || title;
  const socialDescription = custom.ogDescription?.trim() || description;
  const socialImage = custom.ogImageUrl?.trim() || page?.hero?.imageUrl?.trim() || seo.defaultOgImage?.trim() || undefined;
  const canonical = custom.canonicalUrl?.trim() || path;
  const indexable = seo.allowIndexing && !custom.noIndex;

  return {
    title,
    description,
    alternates: { canonical },
    robots: {
      index: indexable,
      follow: indexable,
      googleBot: { index: indexable, follow: indexable, "max-image-preview": "large" },
    },
    openGraph: {
      type: "website",
      title: socialTitle,
      description: socialDescription,
      url: canonical,
      images: socialImage ? [socialImage] : undefined,
    },
    twitter: {
      card: socialImage ? "summary_large_image" : "summary",
      title: socialTitle,
      description: socialDescription,
      images: socialImage ? [socialImage] : undefined,
    },
  };
}
