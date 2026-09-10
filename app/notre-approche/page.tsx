import { PublicFeatureHero } from "@/components/public-feature-hero";

export default function ApproachPage() {
  return (
    <PublicFeatureHero
      active="Notre approche"
      heroClass="hero-approach"
      title={<>Écouter,<br />orienter,<br />accompagner.</>}
      body="MOONY relie information fiable, communauté bienveillante et accès à des professionnelles pour accompagner les femmes à chaque étape de leur vie."
      primaryLabel="Découvrir notre approche"
      primaryHref="/notre-approche"
      secondaryLabel="Voir les services"
      secondaryHref="/services"
      features={[
        { title: "Informer", body: "Des contenus fiables pour mieux comprendre son corps.", icon: "▤" },
        { title: "Relier", body: "Une communauté et des professionnelles accessibles.", icon: "◎" },
        { title: "Accompagner", body: "Un suivi pensé pour le cycle, la maternité et le post-partum.", icon: "⌁" },
      ]}
    />
  );
}
