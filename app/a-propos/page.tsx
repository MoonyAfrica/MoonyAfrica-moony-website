import { PublicFeatureHero } from "@/components/public-feature-hero";

export default function AboutPage() {
  return (
    <PublicFeatureHero
      active="À propos"
      eyebrow="À propos"
      heroClass="hero-about"
      title={<>Une histoire de soin,<br />de transmission<br />et d’horizons.</>}
      body="MOONY est née du désir d’offrir aux femmes un espace de santé plus proche, plus doux et plus enraciné dans leurs réalités. Pensée pour l’Afrique et ouverte sur le monde, la plateforme réunit information fiable, accompagnement, communauté et innovation à chaque étape de la vie."
      primaryLabel="Découvrir notre mission"
      primaryHref="/notre-mission"
      secondaryLabel="Voir notre approche"
      secondaryHref="/notre-approche"
      features={[
        { title: "Nos racines", body: "Une vision née entre culture, soin et transmission.", icon: "▤" },
        { title: "Notre vision", body: "Une santé féminine accessible, humaine et inclusive.", icon: "⌁" },
        { title: "Notre engagement", body: "Relier les femmes à des ressources, une communauté et des professionnelles.", icon: "◎" },
      ]}
    />
  );
}
