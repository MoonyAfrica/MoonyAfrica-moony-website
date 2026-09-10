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

export type NavigationItem = { label: string; href: string; visible?: boolean };
export type PublicNavigationSettings = {
  items: NavigationItem[];
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};
export type FooterLink = { label: string; href: string };
export type FooterColumn = { title: string; links: FooterLink[] };
export type PublicFooterSettings = {
  headline: string;
  body: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  columns: FooterColumn[];
  instagramUrl: string;
  linkedinUrl: string;
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

export const defaultNavigation: PublicNavigationSettings = {
  items: [
    { label: "Accueil", href: "/", visible: true },
    { label: "Notre mission", href: "/notre-mission", visible: true },
    { label: "Notre approche", href: "/notre-approche", visible: true },
    { label: "À propos", href: "/a-propos", visible: true },
    { label: "Nos services", href: "/services", visible: true },
    { label: "Communauté", href: "/communaute", visible: true },
    { label: "Ressources", href: "/ressources", visible: true },
  ],
  primaryLabel: "Prendre rendez-vous",
  primaryHref: "/contact?objet=rendez-vous",
  secondaryLabel: "Se connecter",
  secondaryHref: "https://application.moony-africa.com",
};

export const defaultFooter: PublicFooterSettings = {
  headline: "Pour la santé des femmes, à chaque étape de leur vie.",
  body: "Une expérience de santé féminine pensée pour être utile, rassurante et accessible, avec une ambition africaine et une ouverture sur le monde.",
  primaryLabel: "Accéder à l’application",
  primaryHref: "https://application.moony-africa.com",
  secondaryLabel: "Nous contacter",
  secondaryHref: "/contact",
  columns: [
    { title: "Découvrir", links: [{label:"Notre mission",href:"/notre-mission"},{label:"Notre approche",href:"/notre-approche"},{label:"Nos services",href:"/services"},{label:"Communauté",href:"/communaute"},{label:"Ressources",href:"/ressources"}] },
    { title: "Confiance", links: [{label:"Protection des données",href:"/confidentialite"},{label:"Sécurité",href:"/confidentialite#securite"},{label:"Service client",href:"/support"},{label:"Méthode & qualité",href:"/notre-approche"},{label:"Professionnels de santé",href:"/services#professionnels"}] },
    { title: "Entreprise", links: [{label:"À propos",href:"/a-propos"},{label:"Partenariats",href:"/contact?objet=partenariat"},{label:"Presse",href:"/presse"},{label:"Carrières",href:"/carrieres"},{label:"Nous contacter",href:"/contact"}] },
  ],
  instagramUrl: "",
  linkedinUrl: "",
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

export async function getPublicChromeSettings(): Promise<{ navigation: PublicNavigationSettings; footer: PublicFooterSettings }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { navigation: defaultNavigation, footer: defaultFooter };
  try {
    const { data, error } = await supabase.from("website_settings").select("key,value").in("key", ["navigation", "footer"]);
    if (error) return { navigation: defaultNavigation, footer: defaultFooter };
    const rows = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
    const nav = mergeObject(defaultNavigation, rows.navigation);
    const footer = mergeObject(defaultFooter, rows.footer);
    return {
      navigation: { ...nav, items: Array.isArray(nav.items) ? nav.items : defaultNavigation.items },
      footer: { ...footer, columns: Array.isArray(footer.columns) ? footer.columns : defaultFooter.columns },
    };
  } catch {
    return { navigation: defaultNavigation, footer: defaultFooter };
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
