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
