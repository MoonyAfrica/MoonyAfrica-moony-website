import { PublicFeatureHero } from "@/components/public-feature-hero";

export default function MissionPage() {
  return (
    <PublicFeatureHero
      active="Notre mission"
      heroClass="hero-mission"
      title={<>Notre mission</>}
      body="Rendre la santé féminine plus accessible, plus humaine et plus enracinée dans les réalités des femmes africaines. De la puberté à la maternité, du post-partum au bien-être quotidien, MOONY informe, accompagne et relie les femmes à des ressources fiables, des professionnelles de santé et une communauté bienveillante."
      primaryLabel="Découvrir notre approche"
      primaryHref="/notre-approche"
      secondaryLabel="Voir nos services"
      secondaryHref="/services"
      features={[
        { title: "Informer", body: "Des contenus clairs et adaptés à chaque étape de vie.", icon: "▤" },
        { title: "Accompagner", body: "Un suivi utile, humain et accessible.", icon: "◔" },
        { title: "Relier", body: "Une communauté et des expertes à portée de main.", icon: "◉" },
      ]}
    />
  );
}
