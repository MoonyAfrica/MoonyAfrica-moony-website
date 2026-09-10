import { PublicFeatureHero } from "@/components/public-feature-hero";

export default function ApproachPage() {
  return (
    <PublicFeatureHero
      active="Notre approche"
      heroClass="hero-approach"
      title={<>Écouter,<br />orienter,<br />accompagner.</>}
      body="MOONY relie information fiable, communauté bienveillante et accès à des professionnelles pour accompagner les femmes à chaque étape de leur vie."
      primaryLabel="Voir nos services"
      primaryHref="/services"
      secondaryLabel="Découvrir la communauté"
      secondaryHref="/communaute"
      features={[
        { title: "Informer", body: "Des contenus fiables pour mieux comprendre son corps." },
        { title: "Relier", body: "Une communauté et des professionnelles accessibles." },
        { title: "Accompagner", body: "Un suivi pensé pour le cycle, la maternité et le post-partum." },
      ]}
    />
  );
}
