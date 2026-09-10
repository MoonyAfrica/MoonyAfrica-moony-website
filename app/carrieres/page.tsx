import { PublicInfoPage } from "@/components/public-info-page";

export default function CareersPage() {
  return (
    <PublicInfoPage
      eyebrow="Carrières"
      title="Construire une santé féminine plus accessible demande des talents différents."
      intro="MOONY se construit à l’intersection de la santé, du numérique, de l’expérience utilisateur, du contenu, des partenariats et du développement en Afrique. Les opportunités seront publiées ici au fur et à mesure des besoins de l’équipe."
      sections={[
        { title: "Produit & technologie", body: "Développement web et mobile, data, sécurité, design produit et expérience utilisateur pour construire des outils simples, fiables et utiles." },
        { title: "Santé & contenus", body: "Professionnelles de santé, éditorial, recherche, prévention et vulgarisation pour produire des ressources responsables et compréhensibles." },
        { title: "Partenariats & développement", body: "Relations avec les professionnels, entreprises, institutions et écosystèmes locaux pour déployer MOONY dans différents marchés." },
        { title: "Marketing & communauté", body: "Acquisition, communication, événements, relations publiques et animation de communautés pour faire connaître la mission de MOONY sans perdre son authenticité." },
      ]}
      ctaLabel="Candidature spontanée"
      ctaHref="/contact?objet=carriere"
    />
  );
}
