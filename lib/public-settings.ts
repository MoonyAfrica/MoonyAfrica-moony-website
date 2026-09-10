import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type PricingPlan = {
  key: "monthly" | "quarterly" | "semiannual" | "annual";
  name: string;
  price: number;
  unit: string;
  featured?: boolean;
  active?: boolean;
};

export type PricingSettings = {
  currency: string;
  teleconsultationCommission: number;
  plans: PricingPlan[];
  companyMode: "quote";
  companyLabel: string;
};

export type PublicGeneralSettings = {
  siteName: string;
  email: string;
  phone: string;
  whatsapp: string;
  publicUrl: string;
  appUrl: string;
};

export type PublicSeoSettings = {
  siteTitle: string;
  titleTemplate: string;
  defaultDescription: string;
  defaultOgImage: string;
  defaultLocale: string;
  allowIndexing: boolean;
  organizationName: string;
};

export const defaultPricing: PricingSettings = {
  currency: "FCFA",
  teleconsultationCommission: 3,
  plans: [
    { key: "monthly", name: "Mensuel", price: 15000, unit: "/ mois", featured: false, active: true },
    { key: "quarterly", name: "Trimestriel", price: 42000, unit: "/ trimestre", featured: true, active: true },
    { key: "semiannual", name: "Semestriel", price: 75000, unit: "/ 6 mois", featured: false, active: true },
    { key: "annual", name: "Annuel", price: 150000, unit: "/ an", featured: false, active: true },
  ],
  companyMode: "quote",
  companyLabel: "Tarification sur mesure selon la taille de l’entreprise.",
};

export const defaultGeneral: PublicGeneralSettings = {
  siteName: "MOONY Africa",
  email: "contact@moonyafrica.com",
  phone: "",
  whatsapp: "",
  publicUrl: "https://www.moonyafrica.com",
  appUrl: "https://application.moony-africa.com",
};

export const defaultSeo: PublicSeoSettings = {
  siteTitle: "MOONY Africa — Pour la santé des femmes, à chaque étape de leur vie",
  titleTemplate: "%s | MOONY Africa",
  defaultDescription: "MOONY Africa accompagne la santé des femmes avec une approche humaine, scientifique, accessible et ancrée dans les réalités du continent africain.",
  defaultOgImage: "",
  defaultLocale: "fr_FR",
  allowIndexing: true,
  organizationName: "MOONY Africa",
};

function mergeObject<T extends object>(defaults: T, value: unknown): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  return { ...defaults, ...(value as Partial<T>) };
}

export async function getPublicPricing(): Promise<PricingSettings> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return defaultPricing;

  try {
    const { data, error } = await supabase.from("website_settings").select("value").eq("key", "pricing").maybeSingle();
    if (error || !data?.value || typeof data.value !== "object") return defaultPricing;
    const value = data.value as Partial<PricingSettings>;
    const plans = Array.isArray(value.plans) && value.plans.length ? value.plans : defaultPricing.plans;
    return {
      ...defaultPricing,
      ...value,
      plans: plans.map((plan, index) => ({ ...defaultPricing.plans[index], ...plan })) as PricingPlan[],
    };
  } catch {
    return defaultPricing;
  }
}

export async function getPublicSiteSettings(): Promise<{ general: PublicGeneralSettings; seo: PublicSeoSettings }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { general: defaultGeneral, seo: defaultSeo };

  try {
    const { data, error } = await supabase.from("website_settings").select("key,value").in("key", ["general", "seo"]);
    if (error) return { general: defaultGeneral, seo: defaultSeo };
    const rows = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
    return {
      general: mergeObject(defaultGeneral, rows.general),
      seo: mergeObject(defaultSeo, rows.seo),
    };
  } catch {
    return { general: defaultGeneral, seo: defaultSeo };
  }
}

export function safePublicUrl(value: string) {
  try {
    const url = new URL(value || defaultGeneral.publicUrl);
    return url.origin;
  } catch {
    return defaultGeneral.publicUrl;
  }
}
