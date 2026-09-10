import { PublicFeatureHero } from "@/components/public-feature-hero";

export default function MissionPage() {
  return (
    <PublicFeatureHero
      active="Notre mission"
      heroClass="hero-mission"
      title={<>Notre mission<br /><span className="block max-w-[600px] pt-4 text-[.56em] leading-[1.02] tracking-[-.035em]">Rendre la santé féminine plus accessible, plus humaine et plus enracinée dans les réalités des femmes africaines.</span></>}
      body="De la puberté à la maternité, du post-partum au bien-être quotidien, MOONY informe, accompagne et relie les femmes à des ressources fiables, des professionnelles de santé et une communauté bienveillante."
      primaryLabel="Découvrir notre approche"
      primaryHref="/notre-approche"
      secondaryLabel="Voir nos services"
      secondaryHref="/services"
      features={[
        { title: "Informer", body: "Des contenus clairs et adaptés à chaque étape de vie." },
        { title: "Accompagner", body: "Un suivi utile, humain et accessible." },
        { title: "Relier", body: "Une communauté et des expertes à portée de main." },
      ]}
    />
  );
}
