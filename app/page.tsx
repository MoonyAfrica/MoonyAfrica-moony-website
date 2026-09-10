import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Baby,
  Building2,
  CalendarHeart,
  HeartHandshake,
  Leaf,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { CmsSections } from "@/components/cms-sections";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getPublishedPage } from "@/lib/cms";
import { getPublicPricing } from "@/lib/public-settings";
import { siteConfig } from "@/lib/site-config";

const journeys = [
  { title: "Cycle & règles", text: "Comprendre son cycle, ses symptômes et ses habitudes.", icon: CalendarHeart },
  { title: "Fertilité", text: "Mieux connaître son corps et avancer avec des repères clairs.", icon: HeartHandshake },
  { title: "Grossesse", text: "Être accompagnée avant, pendant et après la maternité.", icon: Baby },
  { title: "Santé & bien-être", text: "Accéder à des contenus utiles pour prendre soin de soi au quotidien.", icon: Leaf },
  { title: "Professionnelles", text: "Trouver des professionnelles de santé et faciliter la prise de rendez-vous.", icon: Stethoscope },
  { title: "Coffre santé", text: "Conserver ses informations importantes dans un espace pensé pour la confidentialité.", icon: LockKeyhole },
];

const resourceCards = [
  { tag: "CYCLE", title: "Mieux comprendre son cycle menstruel", body: "Des repères simples pour mieux lire les signaux de son corps." },
  { tag: "MATERNITÉ", title: "Préparer son post-partum avec plus de sérénité", body: "Anticiper, s’informer et identifier les ressources qui peuvent aider." },
  { tag: "SORORITÉ", title: "Le soutien entre femmes compte aussi", body: "Créer des espaces où l’on peut parler, apprendre et se sentir comprise." },
];

const fallbackHero={
  title:"Ancrée dans nos cultures,\ntournée vers l’avenir.",
  body:"Une expérience de santé féminine qui réunit transmission, communauté, bien-être et innovation à chaque étape de la vie.",
  primaryLabel:"Découvrir la communauté",
  primaryHref:"/communaute",
  secondaryLabel:"Nos services",
  secondaryHref:"/services",
};

export async function generateMetadata():Promise<Metadata>{
  const page=await getPublishedPage("/");
  return {
    title:page?.seo_title||"MOONY Africa — Pour la santé des femmes, à chaque étape de leur vie",
    description:page?.seo_description||page?.hero?.body||fallbackHero.body,
  };
}

export default async function HomePage() {
  const [page,pricing]=await Promise.all([getPublishedPage("/"),getPublicPricing()]);
  const hero=page?.hero??{};
  const monthly=pricing.plans.find(plan=>plan.key==="monthly"&&plan.active!==false)??pricing.plans.find(plan=>plan.active!==false);
  const monthlyPrice=monthly?`${new Intl.NumberFormat("fr-FR").format(monthly.price)} ${pricing.currency}`:"15 000 FCFA";

  return (
    <main className="min-h-screen bg-[#fffaf4] text-[#4a281f]">
      <section className="hero-photo hero-home moony-grain relative min-h-[760px] overflow-hidden lg:min-h-screen">
        <PublicHeader active="Accueil" light />

        <div className="relative z-10 mx-auto flex min-h-[760px] max-w-[1660px] items-center px-5 pb-14 pt-36 sm:px-8 lg:min-h-screen lg:px-12">
          <div className="max-w-[620px] text-[#fff9f3]">
            {hero.eyebrow?<p className="mb-4 text-[11px] font-semibold uppercase tracking-[.3em] text-white/75">{hero.eyebrow}</p>:null}
            <h1 className="moony-serif whitespace-pre-line text-[58px] leading-[.95] tracking-[-0.048em] sm:text-[72px] lg:text-[82px] xl:text-[88px]">
              {hero.title||fallbackHero.title}
            </h1>

            <p className="mt-7 max-w-[500px] text-[17px] leading-[1.55] text-white/92 sm:text-[18px]">
              {hero.body||fallbackHero.body}
            </p>

            <div className="mt-9 flex flex-wrap gap-3 sm:gap-4">
              <Link
                href={hero.primaryHref||fallbackHero.primaryHref}
                className="rounded-full border border-[#e6a174]/75 bg-[#813617] px-7 py-3.5 text-[14px] font-medium text-white shadow-[0_12px_35px_rgba(49,20,12,.12)] transition hover:-translate-y-[1px]"
              >
                {hero.primaryLabel||fallbackHero.primaryLabel}
              </Link>
              {(hero.secondaryLabel||fallbackHero.secondaryLabel)&&(hero.secondaryHref||fallbackHero.secondaryHref)?<Link
                href={hero.secondaryHref||fallbackHero.secondaryHref}
                className="rounded-full border border-white/75 bg-[#3b1d15]/10 px-7 py-3.5 text-[14px] font-medium text-white backdrop-blur-[2px] transition hover:bg-white/10"
              >
                {hero.secondaryLabel||fallbackHero.secondaryLabel}
              </Link>:null}
            </div>

            <div className="mt-14 flex items-center gap-4 text-[10px] font-medium uppercase tracking-[.27em] text-white/68">
              <span className="h-px w-10 bg-white/55" />
              <span>Santé</span><span>•</span><span>Sororité</span><span>•</span><span>Avenir</span>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[3] h-24 bg-gradient-to-t from-[#4a2116]/18 to-transparent" />
      </section>

      <section className="moony-paper border-b border-[#5b2f22]/10">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-6 py-16 lg:grid-cols-[.78fr_1.22fr] lg:px-12 lg:py-24">
          <div className="max-w-[500px]">
            <p className="text-[11px] font-semibold uppercase tracking-[.3em] text-[#9d4c27]">Une santé féminine plus proche</p>
            <h2 className="moony-serif mt-4 text-[48px] leading-[.98] tracking-[-.04em] sm:text-[58px]">Pensée pour la vraie vie des femmes.</h2>
            <p className="mt-6 text-[16px] leading-7 text-[#5b2f22]/72">MOONY rassemble dans une même expérience des repères de santé, des ressources, une communauté et l’accès à des professionnelles. L’objectif : rendre le parcours plus lisible, plus humain et plus accessible.</p>
            <Link href="/notre-approche" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#8d3b19]">Découvrir notre approche <ArrowUpRight size={16} /></Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {journeys.map(({ title, text, icon: Icon }) => (
              <article key={title} className="rounded-[22px] border border-[#5b2f22]/10 bg-white/66 p-6 shadow-[0_12px_38px_rgba(85,44,30,.045)]">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-[#f2d9c7] text-[#8d3b19]"><Icon size={20} strokeWidth={1.55} /></div>
                <h3 className="moony-serif mt-5 text-[27px] leading-none">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#5b2f22]/66">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#4b271d] text-[#fff8f1]">
        <div className="mx-auto max-w-[1500px] px-6 py-16 lg:px-12 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.3em] text-[#e9b78f]">Confiance & responsabilité</p>
              <h2 className="moony-serif mt-4 max-w-[630px] text-[46px] leading-[1] tracking-[-.04em] sm:text-[58px]">La confiance n’est pas une option. C’est une base.</h2>
            </div>
            <p className="max-w-[650px] text-[16px] leading-7 text-white/68 lg:justify-self-end">Une plateforme de santé doit expliquer clairement ce qu’elle fait, pourquoi elle collecte certaines informations et comment elles sont protégées. MOONY construit son expérience autour de la confidentialité, de la transparence et de la minimisation des données.</p>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            <article className="rounded-[22px] border border-white/12 bg-white/[.045] p-6"><ShieldCheck size={23} strokeWidth={1.4} /><h3 className="moony-serif mt-5 text-2xl">Protection des données</h3><p className="mt-2 text-sm leading-6 text-white/58">Des principes de sécurité et de confidentialité intégrés dès la conception.</p></article>
            <article className="rounded-[22px] border border-white/12 bg-white/[.045] p-6"><Stethoscope size={23} strokeWidth={1.4} /><h3 className="moony-serif mt-5 text-2xl">Information de qualité</h3><p className="mt-2 text-sm leading-6 text-white/58">Des contenus conçus pour informer sans remplacer une consultation médicale.</p></article>
            <article className="rounded-[22px] border border-white/12 bg-white/[.045] p-6"><Users size={23} strokeWidth={1.4} /><h3 className="moony-serif mt-5 text-2xl">Respect des réalités</h3><p className="mt-2 text-sm leading-6 text-white/58">Une expérience adaptée à des contextes culturels, sociaux et économiques variés.</p></article>
          </div>

          <Link href="/confidentialite" className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-medium hover:bg-white/7">En savoir plus sur notre engagement <ArrowUpRight size={15} /></Link>
        </div>
      </section>

      <section className="border-b border-[#5b2f22]/10 bg-[#fffaf4]">
        <div className="mx-auto max-w-[1500px] px-6 py-16 lg:px-12 lg:py-24">
          <div className="max-w-[800px]"><p className="text-[11px] font-semibold uppercase tracking-[.3em] text-[#9d4c27]">Pour les professionnelles & les organisations</p><h2 className="moony-serif mt-4 text-[48px] leading-[.98] tracking-[-.04em] sm:text-[58px]">MOONY relie aussi celles et ceux qui accompagnent les femmes.</h2></div>

          <div className="mt-9 grid gap-4 lg:grid-cols-2">
            <article className="rounded-[28px] border border-[#5b2f22]/10 bg-[#f7e8dd] p-7 sm:p-9">
              <div className="flex items-start justify-between gap-5"><div className="grid h-12 w-12 place-items-center rounded-full bg-white/70 text-[#8d3b19]"><Stethoscope size={22} strokeWidth={1.5} /></div><span className="rounded-full border border-[#7c3c22]/20 bg-white/48 px-3 py-1.5 text-[11px]">MOONY Pro</span></div>
              <h3 className="moony-serif mt-8 text-[38px] leading-none">Professionnels de santé</h3>
              <p className="mt-4 max-w-[560px] text-sm leading-6 text-[#5b2f22]/68">Profil professionnel, rendez-vous, agenda, téléconsultation, messagerie et outils pour mieux organiser la relation avec les patientes.</p>
              <div className="mt-6 flex flex-wrap items-center gap-3"><Link href="/services#professionnels" className="rounded-full bg-[#7e3518] px-6 py-3 text-sm font-medium text-white">Voir les offres</Link><span className="text-xs text-[#5b2f22]/55">À partir de {monthlyPrice} / mois</span></div>
            </article>

            <article className="rounded-[28px] border border-[#5b2f22]/10 bg-[#efe1d3] p-7 sm:p-9">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-white/70 text-[#8d3b19]"><Building2 size={22} strokeWidth={1.5} /></div>
              <h3 className="moony-serif mt-8 text-[38px] leading-none">Entreprises & institutions</h3>
              <p className="mt-4 max-w-[560px] text-sm leading-6 text-[#5b2f22]/68">Des dispositifs sur mesure pour soutenir la santé, la prévention et le bien-être des collaboratrices, avec un espace RH dédié.</p>
              <div className="mt-6 flex flex-wrap gap-3"><Link href="/contact?objet=entreprise" className="rounded-full bg-[#7e3518] px-6 py-3 text-sm font-medium text-white">Parler à notre équipe</Link><Link href="/services#entreprises" className="rounded-full border border-[#5b2f22]/35 px-6 py-3 text-sm font-medium">Découvrir l’offre</Link></div>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-[#edc5a7]/30">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-6 py-16 lg:grid-cols-[.95fr_1.05fr] lg:items-center lg:px-12 lg:py-20">
          <div className="rounded-[32px] border border-[#5b2f22]/10 bg-[#ba693f] p-8 text-[#fff8f1] shadow-[0_20px_60px_rgba(93,49,32,.1)] sm:p-10">
            <div className="mx-auto flex min-h-[300px] max-w-[460px] items-center justify-center rounded-[26px] border border-white/15 bg-[radial-gradient(circle_at_50%_20%,rgba(255,224,194,.28),transparent_38%),linear-gradient(145deg,#a65331,#c98058)]">
              <div className="text-center"><div className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-white/25 bg-white/10"><Leaf size={42} strokeWidth={1.1} /></div><p className="moony-serif mt-5 text-3xl">MOONY Réutilisable</p></div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.3em] text-[#9d4c27]">Au-delà du numérique</p>
            <h2 className="moony-serif mt-4 text-[48px] leading-[.98] tracking-[-.04em] sm:text-[58px]">Des protections réutilisables pour une santé menstruelle plus durable.</h2>
            <p className="mt-5 max-w-[650px] text-[16px] leading-7 text-[#5b2f22]/70">MOONY porte aussi une vision concrète de l’autonomie menstruelle et du développement durable avec des solutions réutilisables pensées pour durer.</p>
            <Link href="/protections-reutilisables" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#8d3b19]">Découvrir les protections <ArrowUpRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="bg-[#fffaf4]">
        <div className="mx-auto max-w-[1500px] px-6 py-16 lg:px-12 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[.3em] text-[#9d4c27]">Ressources</p><h2 className="moony-serif mt-3 text-[46px] leading-none sm:text-[56px]">Comprendre, apprendre, avancer.</h2></div><Link href="/ressources" className="inline-flex items-center gap-2 text-sm font-semibold text-[#8d3b19]">Voir toutes les ressources <ArrowUpRight size={15} /></Link></div>
          <div className="mt-9 grid gap-4 lg:grid-cols-3">
            {resourceCards.map((card, index) => (
              <article key={card.title} className="group overflow-hidden rounded-[24px] border border-[#5b2f22]/10 bg-white"><div className={`h-44 ${index === 0 ? "bg-[linear-gradient(135deg,#6e3b2b,#c1815e)]" : index === 1 ? "bg-[linear-gradient(135deg,#ddbea7,#a86845)]" : "bg-[linear-gradient(135deg,#89523d,#e3b69a)]"}`} /><div className="p-6"><span className="text-[10px] font-semibold tracking-[.18em] text-[#a15837]">{card.tag}</span><h3 className="moony-serif mt-3 text-[29px] leading-[1.04]">{card.title}</h3><p className="mt-3 text-sm leading-6 text-[#5b2f22]/64">{card.body}</p><Link href="/ressources" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#8d3b19]">Lire <ArrowUpRight size={14} /></Link></div></article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#5b2f22]/10 bg-[#f5e6da]">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-6 py-14 lg:grid-cols-[1fr_auto] lg:items-center lg:px-12"><div><p className="text-[11px] font-semibold uppercase tracking-[.28em] text-[#9d4c27]">L’expérience MOONY</p><h2 className="moony-serif mt-3 text-[42px] leading-[1.02] sm:text-[50px]">Votre santé. Votre rythme. Votre espace.</h2><p className="mt-3 text-sm leading-6 text-[#5b2f22]/65">Accédez à MOONY et retrouvez vos parcours, vos ressources et votre communauté.</p></div><a href={siteConfig.appUrl} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7e3518] px-7 py-3.5 text-sm font-medium text-white">Accéder à l’application <ArrowUpRight size={15} /></a></div>
      </section>

      <CmsSections sections={page?.sections ?? []} />
      <PublicFooter />
    </main>
  );
}
