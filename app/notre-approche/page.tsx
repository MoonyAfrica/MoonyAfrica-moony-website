import type { Metadata } from "next";
import { PublicFeatureHero } from "@/components/public-feature-hero";
import { getPublishedPage, heroLines } from "@/lib/cms";

const fallbackTitle = ["Écouter,", "orienter,", "accompagner."];
const fallbackBody = "MOONY relie information fiable, communauté bienveillante et accès à des professionnelles pour accompagner les femmes à chaque étape de leur vie.";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("/notre-approche");
  return {
    title: page?.seo_title || "Notre approche — MOONY Africa",
    description: page?.seo_description || page?.hero?.body || fallbackBody,
  };
}

export default async function ApproachPage() {
  const page = await getPublishedPage("/notre-approche");
  const hero = page?.hero ?? {};
  const lines = heroLines(hero.title, fallbackTitle);

  return (
    <PublicFeatureHero
      active="Notre approche"
      eyebrow={hero.eyebrow}
      heroClass="hero-approach"
      title={<>{lines.map((line, index) => <span key={`${line}-${index}`} className="block">{line}</span>)}</>}
      body={hero.body || fallbackBody}
      primaryLabel={hero.primaryLabel || "Voir nos services"}
      primaryHref={hero.primaryHref || "/services"}
      secondaryLabel={hero.secondaryLabel || "Découvrir la communauté"}
      secondaryHref={hero.secondaryHref || "/communaute"}
      features={[
        { title: "Informer", body: "Des contenus fiables pour mieux comprendre son corps." },
        { title: "Relier", body: "Une communauté et des professionnelles accessibles." },
        { title: "Accompagner", body: "Un suivi pensé pour le cycle, la maternité et le post-partum." },
      ]}
    />
  );
}
