import { PublicFeatureHero } from "@/components/public-feature-hero";

export default function CommunityPage() {
  return (
    <PublicFeatureHero
      active="Communauté"
      heroClass="hero-community"
      title={<>Une communauté<br />pensée pour écouter,<br />partager et avancer<br />ensemble.</>}
      body="Avec Entre Elles, MOONY offre un espace bienveillant où les femmes peuvent échanger, poser leurs questions, trouver du soutien et accéder à des ressources adaptées à chaque étape de leur vie."
      primaryLabel="Rejoindre la communauté"
      primaryHref="https://application.moony-africa.com"
      features={[
        { title: "Entre Elles", body: "Un espace d’échange libre et bienveillant entre femmes.", icon: "◎" },
        { title: "Groupes thématiques", body: "Cycle, fertilité, maternité, post-partum, bien-être et plus.", icon: "⌁" },
        { title: "Témoignages", body: "Des expériences vécues pour se sentir comprise et soutenue.", icon: "♡" },
      ]}
    />
  );
}
