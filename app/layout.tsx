import type { CSSProperties, Metadata } from "react";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { MarketingLayer } from "@/components/marketing-layer";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOONY Africa — Pour la santé des femmes, à chaque étape de leur vie",
  description:
    "MOONY Africa accompagne la santé des femmes avec une approche humaine, scientifique, accessible et ancrée dans les réalités du continent africain.",
};

type Theme = { accent?:string; surface?:string; ink?:string; overlay?:number; radius?:number; heroImageUrl?:string; heroPosition?:string };

async function getTheme(): Promise<Theme> {
  const supabase=getSupabaseAdmin(); if(!supabase)return{};
  try { const {data}=await supabase.from("website_settings").select("value").eq("key","branding").maybeSingle(); return (data?.value as {theme?:Theme}|undefined)?.theme ?? {}; } catch { return {}; }
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
