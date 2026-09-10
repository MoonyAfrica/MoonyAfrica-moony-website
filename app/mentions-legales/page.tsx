import { PublicInfoPage } from "@/components/public-info-page";

export default function LegalPage() {
  return (
    <PublicInfoPage
      eyebrow="Informations légales"
      title="Mentions légales"
      intro="Cette page rassemble les informations légales générales du site MOONY Africa. Les mentions définitives seront complétées avec les informations de la société, l’hébergeur, les coordonnées officielles et les obligations applicables avant la mise en production publique."
      sections={[
        { title: "Éditeur du site", body: "MOONY Africa. Les informations d’immatriculation, l’adresse du siège, la forme juridique et les coordonnées officielles seront affichées ici après finalisation de la structure juridique." },
        { title: "Hébergement", body: "Les informations relatives à l’hébergeur et à l’infrastructure technique du site seront ajoutées avant publication définitive." },
        { title: "Propriété intellectuelle", body: "La marque MOONY, ses éléments graphiques, textes, contenus et créations originales sont protégés. Toute réutilisation doit respecter les droits applicables et les autorisations accordées." },
        { title: "Responsabilité", body: "Les informations publiées sur le site sont destinées à informer et présenter les services MOONY. Elles ne remplacent pas un diagnostic, un avis médical ou une consultation avec un professionnel de santé." },
      ]}
      ctaLabel="Nous contacter"
      ctaHref="/contact?objet=legal"
    />
  );
}
