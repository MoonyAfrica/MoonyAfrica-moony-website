import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { CalendarDays, Heart, Sprout, Users } from "lucide-react";
import { CmsSections } from "@/components/cms-sections";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getPublishedPage } from "@/lib/cms";
import { buildCmsMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

const pillars = [
  { title: "Entre elles", body: "Un espace d’échange libre et bienveillant entre femmes.", icon: Users },
  { title: "Groupes thématiques", body: "Cycle, fertilité, maternité, post-partum, bien-être et plus.", icon: Sprout },
  { title: "Témoignages & partages", body: "Des expériences vécues pour se sentir comprise et soutenue.", icon: Heart },
  { title: "Événements & ateliers", body: "Rencontres, conversations et contenus pour apprendre ensemble.", icon: CalendarDays },
];

const fallbackHero = {
  title: "Une communauté\npensée pour écouter,\npartager et avancer\nensemble.",
  body: "Avec Entre elles, MOONY offre un espace bienveillant où les femmes peuvent échanger, poser leurs questions, trouver du soutien et accéder à des ressources adaptées à chaque étape de leur vie.",
  primaryLabel: "Rejoindre la communauté",
};

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("/communaute");
  return buildCmsMetadata({ page, fallbackTitle: "Communauté — MOONY Africa", fallbackDescription: fallbackHero.body, path: "/communaute" });
}

function safeBackgroundUrl(value:string){return value.replace(/["'\n\r()]/g,"");}

export default async function CommunityPage() {
  const page = await getPublishedPage("/communaute");
  const hero = page?.hero ?? {};
  const heroStyle = hero.imageUrl ? ({
    "--moony-page-hero-image": `url("${safeBackgroundUrl(hero.imageUrl)}")`,
    "--moony-page-hero-position": hero.imagePosition || "65% center",
  } as CSSProperties) : undefined;
  return (
    <main className="min-h-screen bg-[#fffaf4] text-[#5b2f22]">
      <section style={heroStyle} className="hero-photo hero-community moony-grain relative min-h-[700px] overflow-hidden">
        <PublicHeader active="Communauté" />
        <div className="relative z-10 mx-auto flex min-h-[700px] max-w-[1660px] items-center px-5 pb-10 pt-36 sm:px-8 lg:px-12">
          <div className="max-w-[610px]">
            {hero.eyebrow ? <p className="mb-4 text-[11px] font-semibold uppercase tracking-[.3em] text-[#9d4c27]">{hero.eyebrow}</p> : null}
            <h1 className="moony-serif whitespace-pre-line text-[54px] leading-[.96] tracking-[-.048em] sm:text-[66px] lg:text-[76px]">{hero.title || fallbackHero.title}</h1>
            <p className="mt-6 max-w-[535px] text-[17px] leading-[1.5] text-[#5b2f22]/82">{hero.body || fallbackHero.body}</p>
            <a href={hero.primaryHref || siteConfig.appUrl} className="mt-8 inline-flex rounded-full bg-[#853718] px-8 py-3.5 text-[14px] font-medium text-white shadow-[0_12px_34px_rgba(91,47,34,.09)] transition hover:-translate-y-[1px]">{hero.primaryLabel || fallbackHero.primaryLabel}</a>
          </div>
          <div className="pointer-events-none absolute right-[7%] top-[18%] hidden max-w-[245px] rotate-[-4deg] text-center xl:block"><p className="moony-serif text-[26px] italic leading-[1.2] text-[#7a4029]/72">Des femmes qui se soutiennent vont plus loin.</p><span className="mx-auto mt-5 block h-px w-10 bg-[#7a4029]/45" /></div>
        </div>
      </section>

      <section className="relative z-10 border-y border-[#5b2f22]/10 bg-[#fffaf4]">
        <div className="mx-auto grid max-w-[1660px] px-5 py-9 sm:px-8 md:grid-cols-2 lg:grid-cols-4 lg:px-12">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <article key={pillar.title} className={`px-5 py-6 text-center lg:px-8 ${index ? "lg:border-l lg:border-[#5b2f22]/14" : ""}`}>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f5ded0] text-[#8f3f20]"><Icon size={25} strokeWidth={1.5} /></div>
                <h2 className="moony-serif mt-4 text-[28px] leading-none">{pillar.title}</h2>
                <p className="mx-auto mt-3 max-w-[250px] text-[14px] leading-5 text-[#5b2f22]/72">{pillar.body}</p>
              </article>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 px-6 pb-10 text-[13px] text-[#7a4029]/78 sm:gap-6"><span className="h-px w-14 bg-[#9b684e]/35" /><span>Sororité</span><span>•</span><span>Confidentialité</span><span>•</span><span>Bienveillance</span><span>•</span><span>Partage</span><span className="h-px w-14 bg-[#9b684e]/35" /></div>
      </section>

      <section className="bg-[#f3e5d8]">
        <div className="mx-auto grid max-w-[1500px] gap-7 px-6 py-14 lg:grid-cols-[1fr_auto] lg:items-center lg:px-12">
          <div><p className="text-[11px] font-semibold uppercase tracking-[.28em] text-[#9d4c27]">Entre elles</p><h2 className="moony-serif mt-3 text-[42px] leading-[1.02] sm:text-[50px]">La communauté complète vit dans l’application MOONY.</h2><p className="mt-3 max-w-[720px] text-sm leading-6 text-[#5b2f22]/66">Rejoignez les discussions, les groupes thématiques et les espaces d’entraide depuis votre compte MOONY.</p></div>
          <a href={siteConfig.appUrl} className="rounded-full bg-[#7e3518] px-7 py-3.5 text-center text-sm font-medium text-white">Rejoindre la communauté</a>
        </div>
      </section>

      <CmsSections sections={page?.sections ?? []} />
      <PublicFooter />
    </main>
  );
}
