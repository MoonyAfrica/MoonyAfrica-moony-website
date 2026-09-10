import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { MarketingLayer } from "@/components/marketing-layer";
import { getPublicSiteSettings, safePublicUrl } from "@/lib/public-settings";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import "./globals.css";

type Theme = { accent?:string; surface?:string; ink?:string; overlay?:number; radius?:number; heroImageUrl?:string; heroPosition?:string };

async function getTheme(): Promise<Theme> {
  const supabase=getSupabaseAdmin(); if(!supabase)return{};
  try { const {data}=await supabase.from("website_settings").select("value").eq("key","branding").maybeSingle(); return (data?.value as {theme?:Theme}|undefined)?.theme ?? {}; } catch { return {}; }
}

export async function generateMetadata(): Promise<Metadata> {
  const { general, seo } = await getPublicSiteSettings();
  const baseUrl = safePublicUrl(general.publicUrl);
  const socialImage = seo.defaultOgImage?.trim() || undefined;

  return {
    metadataBase: new URL(baseUrl),
    applicationName: general.siteName || seo.organizationName,
    title: {
      default: seo.siteTitle,
      template: seo.titleTemplate?.includes("%s") ? seo.titleTemplate : "%s | MOONY Africa",
    },
    description: seo.defaultDescription,
    robots: {
      index: seo.allowIndexing,
      follow: seo.allowIndexing,
      googleBot: {
        index: seo.allowIndexing,
        follow: seo.allowIndexing,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: seo.defaultLocale || "fr_FR",
      siteName: seo.organizationName || general.siteName,
      title: seo.siteTitle,
      description: seo.defaultDescription,
      images: socialImage ? [socialImage] : undefined,
    },
    twitter: {
      card: socialImage ? "summary_large_image" : "summary",
      title: seo.siteTitle,
      description: seo.defaultDescription,
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme=await getTheme();
  const overlay=Math.min(92,Math.max(35,Number(theme.overlay)||82));
  const image=(theme.heroImageUrl||"/images/home-hero.jpg").replace(/["'\n\r]/g,"");
  const style={
    "--moony-accent":theme.accent||"#7e3518",
    "--moony-surface":theme.surface||"#fffaf4",
    "--moony-ink":theme.ink||"#5b2f22",
    "--moony-radius":`${Number(theme.radius)||22}px`,
    "--moony-home-overlay-strong":String(overlay/100),
    "--moony-home-overlay-mid":String(Math.max((overlay-16)/100,.08)),
    "--moony-home-hero-image":`url("${image}")`,
    "--moony-home-hero-position":theme.heroPosition||"62% center",
  } as CSSProperties;
  return (
    <html lang="fr">
      <body style={style}>
        {children}
        <MarketingLayer />
        <AnalyticsTracker />
      </body>
    </html>
  );
}
