import { PublicInfoPage } from "@/components/public-info-page";

export default function PressPage() {
  return (
    <PublicInfoPage
      eyebrow="Presse"
      title="MOONY, une nouvelle voix pour la santé des femmes."
      intro="Journalistes, médias, créatrices de contenu et organisations peuvent contacter l’équipe MOONY pour des demandes d’interview, de dossier de presse, de partenariat éditorial ou d’information sur notre mission et nos projets."
      sections={[
        { title: "Notre histoire", body: "MOONY est née d’une ambition : rapprocher la santé féminine des réalités quotidiennes des femmes en Afrique et construire une expérience plus accessible, plus humaine et plus utile." },
        { title: "Sujets & expertises", body: "Santé féminine, santé menstruelle, maternité, prévention, accès aux soins, innovation numérique, entrepreneuriat féminin et développement durable font partie des sujets que nous portons." },
        { title: "Kit média", body: "Les éléments de marque, biographies, visuels officiels et documents presse seront centralisés ici à mesure de leur publication." },
        { title: "Demandes presse", body: "Pour organiser une interview, demander des informations ou préparer un sujet, contactez directement l’équipe MOONY via notre formulaire dédié." },
      ]}
      ctaLabel="Contacter la presse"
      ctaHref="/contact?objet=presse"
    />
  );
}
