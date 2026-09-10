import type { Metadata } from "next";
import { PublicFeatureHero } from "@/components/public-feature-hero";
import { getPublishedPage, heroLines } from "@/lib/cms";
import { buildCmsMetadata } from "@/lib/seo";

const fallbackTitle = [
  "Notre mission",
  "Rendre la santé féminine plus accessible, plus humaine et plus enracinée dans les réalités des femmes africaines.",
];
const fallbackBody = "De la puberté à la maternité, du post-partum au bien-être quotidien, MOONY informe, accompagne et relie les femmes à des ressources fiables, des professionnelles de santé et une communauté bienveillante.";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("/notre-mission");
  return buildCmsMetadata({ page, fallbackTitle: "Notre mission — MOONY Africa", fallbackDescription: fallbackBody, path: "/notre-mission" });
}

export default async function MissionPage() {
  const page = await getPublishedPage("/notre-mission");
  const hero = page?.hero ?? {};
  const lines = heroLines(hero.title, fallbackTitle);

  return (
    <PublicFeatureHero
      active="Notre mission"
      heroClass="hero-mission"
      eyebrow={hero.eyebrow}
      title={
        <>
          {lines[0]}
          {lines.slice(1).map((line, index) => (
            <span key={`${line}-${index}`} className="block max-w-[650px] pt-4 text-[.56em] leading-[1.02] tracking-[-.035em]">
              {line}
            </span>
          ))}
        </>
      }
      body={hero.body || fallbackBody}
      primaryLabel={hero.primaryLabel || "Découvrir notre approche"}
      primaryHref={hero.primaryHref || "/notre-approche"}
      secondaryLabel={hero.secondaryLabel || "Voir nos services"}
      secondaryHref={hero.secondaryHref || "/services"}
      features={[
        { title: "Informer", body: "Des contenus clairs et adaptés à chaque étape de vie." },
        { title: "Accompagner", body: "Un suivi utile, humain et accessible." },
        { title: "Relier", body: "Une communauté et des expertes à portée de main." },
      ]}
    />
  );
}
