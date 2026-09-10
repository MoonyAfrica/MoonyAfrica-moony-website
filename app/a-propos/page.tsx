import type { Metadata } from "next";
import { PublicFeatureHero } from "@/components/public-feature-hero";
import { getPublishedPage, heroLines } from "@/lib/cms";

const fallbackTitle = ["Une histoire de soin,", "de transmission", "et d’horizons."];
const fallbackBody = "MOONY est née du désir d’offrir aux femmes un espace de santé plus proche, plus doux et plus enraciné dans leurs réalités. Pensée pour l’Afrique et ouverte sur le monde, la plateforme réunit information fiable, accompagnement, communauté et innovation à chaque étape de la vie.";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("/a-propos");
  return {
    title: page?.seo_title || "À propos — MOONY Africa",
    description: page?.seo_description || page?.hero?.body || fallbackBody,
  };
}

export default async function AboutPage() {
  const page = await getPublishedPage("/a-propos");
  const hero = page?.hero ?? {};
  const lines = heroLines(hero.title, fallbackTitle);

  return (
    <PublicFeatureHero
      active="À propos"
      eyebrow={hero.eyebrow || "À propos"}
      heroClass="hero-about"
      title={<>{lines.map((line, index) => <span key={`${line}-${index}`} className="block">{line}</span>)}</>}
      body={hero.body || fallbackBody}
      primaryLabel={hero.primaryLabel || "Découvrir notre mission"}
      primaryHref={hero.primaryHref || "/notre-mission"}
      secondaryLabel={hero.secondaryLabel || "Voir notre approche"}
      secondaryHref={hero.secondaryHref || "/notre-approche"}
      features={[
        { title: "Nos racines", body: "Une vision née entre culture, soin et transmission.", icon: "▤" },
        { title: "Notre vision", body: "Une santé féminine accessible, humaine et inclusive.", icon: "⌁" },
        { title: "Notre engagement", body: "Relier les femmes à des ressources, une communauté et des professionnelles.", icon: "◎" },
      ]}
    />
  );
}
