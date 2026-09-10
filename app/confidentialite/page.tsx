import { PublicInfoPage } from "@/components/public-info-page";

export default function PrivacyPage() {
  return (
    <PublicInfoPage
      eyebrow="Confidentialité & sécurité"
      title="Votre confiance mérite des règles claires."
      intro="MOONY traite des informations liées à la santé féminine. Cela implique une responsabilité particulière : collecter le minimum nécessaire, expliquer les usages et protéger les données avec des mesures techniques et organisationnelles adaptées."
      sections={[
        { title: "Minimisation des données", body: "Nous concevons les parcours pour limiter la collecte aux informations utiles au service demandé, plutôt que de collecter des données simplement parce que la technologie le permet." },
        { title: "Transparence", body: "Les utilisatrices doivent pouvoir comprendre quelles informations sont demandées, pour quelle finalité et dans quel contexte elles sont utilisées." },
        { title: "Sécurité dès la conception", body: "Contrôles d’accès, séparation des rôles, chiffrement lorsque cela est pertinent, journalisation et bonnes pratiques de développement font partie de l’architecture de confiance de MOONY." },
        { title: "Maîtrise par l’utilisatrice", body: "Les paramètres de confidentialité et les choix de partage doivent rester compréhensibles, accessibles et cohérents avec les services utilisés." },
        { title: "Données sensibles", body: "Les données de santé exigent un niveau d’attention renforcé. MOONY ne les traite pas comme de simples données marketing et limite les usages secondaires non nécessaires." },
        { title: "Amélioration continue", body: "La sécurité et la conformité évoluent avec le produit, les pays de déploiement et les exigences applicables. Les politiques et mesures sont donc réévaluées régulièrement." },
      ]}
      ctaLabel="Contacter l’équipe"
      ctaHref="/contact?objet=confidentialite"
    />
  );
}
