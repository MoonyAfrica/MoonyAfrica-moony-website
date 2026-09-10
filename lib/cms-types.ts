export type CmsSectionType =
  | "text"
  | "image_text"
  | "cards"
  | "stats"
  | "cta"
  | "quote"
  | "faq"
  | "testimonials"
  | "partners"
  | "newsletter"
  | "spacer";

export type CmsSectionItem = {
  id?: string;
  title?: string;
  body?: string;
  value?: string;
  label?: string;
  href?: string;
};

export type CmsSection = {
  id: string;
  type: CmsSectionType;
  hidden?: boolean;
  eyebrow?: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageSide?: "left" | "right";
  ctaLabel?: string;
  ctaHref?: string;
  background?: "ivory" | "peach" | "terracotta" | "brown";
  items?: CmsSectionItem[];
};

export function createCmsSection(type: CmsSectionType): CmsSection {
  const id = globalThis.crypto?.randomUUID?.() ?? `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const common = { id, type, hidden: false, background: "ivory" as const };
  switch (type) {
    case "text": return { ...common, eyebrow: "Notre engagement", title: "Un titre éditorial", body: "Ajoutez ici le texte de cette section." };
    case "image_text": return { ...common, title: "Une histoire à raconter", body: "Ajoutez votre texte et choisissez une image.", imageUrl: "", imageAlt: "", imageSide: "right", ctaLabel: "En savoir plus", ctaHref: "/" };
    case "cards": return { ...common, title: "À découvrir", items: [{ title: "Premier axe", body: "Description courte." }, { title: "Deuxième axe", body: "Description courte." }, { title: "Troisième axe", body: "Description courte." }] };
    case "stats": return { ...common, title: "Notre impact", items: [{ value: "—", label: "Indicateur" }, { value: "—", label: "Indicateur" }, { value: "—", label: "Indicateur" }] };
    case "cta": return { ...common, title: "Envie d’en savoir plus ?", body: "Notre équipe est à votre écoute.", ctaLabel: "Nous contacter", ctaHref: "/contact", background: "brown" };
    case "quote": return { ...common, body: "Une phrase forte qui porte la vision de MOONY." };
    case "faq": return { ...common, title: "Questions fréquentes", items: [{ title: "Votre question ?", body: "Votre réponse." }] };
    case "testimonials": return { ...common, eyebrow: "Témoignages", title: "Elles parlent de MOONY" };
    case "partners": return { ...common, eyebrow: "Confiance", title: "Ils nous font confiance" };
    case "newsletter": return { ...common, eyebrow: "Newsletter", title: "Recevez les nouvelles de MOONY", body: "Des ressources, actualités et rendez-vous utiles, directement dans votre boîte mail." };
    case "spacer": return { ...common };
  }
}
