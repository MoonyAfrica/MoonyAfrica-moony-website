import Link from "next/link";
import { BriefcaseBusiness, Building2, CalendarDays, Check, HeartPulse, LockKeyhole, MessageCircle, Stethoscope, Users } from "lucide-react";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { siteConfig } from "@/lib/site-config";

const userServices = [
  ["Suivi menstruel", CalendarDays],
  ["Grossesse & post-partum", HeartPulse],
  ["Santé féminine & bien-être", Stethoscope],
  ["Éducation & contenus", BriefcaseBusiness],
  ["Communauté Entre elles", Users],
  ["Rendez-vous", MessageCircle],
  ["Coffre santé", LockKeyhole],
] as const;

const plans = [
  { name: "Mensuel", price: "15 000 FCFA", unit: "/ mois", featured: false },
  { name: "Trimestriel", price: "42 000 FCFA", unit: "/ trimestre", featured: true },
  { name: "Semestriel", price: "75 000 FCFA", unit: "/ 6 mois", featured: false },
  { name: "Annuel", price: "150 000 FCFA", unit: "/ an", featured: false },
];

const benefits = [
  "Profil professionnel vérifié",
  "Prise de rendez-vous en ligne",
  "Agenda et gestion des consultations",
  "Téléconsultation — commission 3%",
  "Messagerie sécurisée",
  "Statistiques et suivi d’activité",
  "Badge Professionnel MOONY",
];

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-[#fbf5ee] text-[#5b2f22]">
      <section className="relative overflow-hidden border-b border-[#5b2f22]/10 bg-[linear-gradient(100deg,#fbf5ee_0%,#f2dfcc_64%,#c9865b_100%)] pt-36">
        <PublicHeader active="Nos services" />
        <div className="mx-auto max-w-[1500px] px-6 pb-12 lg:px-12">
          <p className="text-[11px] font-semibold uppercase tracking-[.35em] text-[#a45b35]">Nos services</p>
          <h1 className="moony-serif mt-3 max-w-[850px] text-5xl leading-[.98] tracking-[-.045em] sm:text-6xl lg:text-7xl">Des solutions pensées pour chaque étape de la vie</h1>
          <p className="mt-5 max-w-[780px] text-[17px] leading-7 text-[#5b2f22]/75">Prévention, accompagnement, soins et bien-être : MOONY réunit des services utiles, accessibles et fiables pour les femmes, les professionnels de santé et les organisations.</p>
        </div>
      </section>

      <section className="border-b border-[#5b2f22]/10 bg-white/52">
        <div className="mx-auto max-w-[1500px] px-6 py-10 lg:px-12">
          <div className="flex flex-col gap-7 xl:flex-row xl:items-center">
            <div className="min-w-[300px]">
              <p className="text-[11px] font-semibold uppercase tracking-[.25em] text-[#a15837]">Pour elles</p>
              <h2 className="moony-serif mt-2 text-4xl">Pour les utilisatrices</h2>
              <p className="mt-1 text-[#5b2f22]/70">Un accès gratuit, pour toutes les femmes.</p>
            </div>
            <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {userServices.map(([item, Icon]) => (
                <div key={item} className="rounded-2xl border border-[#5b2f22]/8 bg-[#f8e9dc] px-4 py-5 text-center text-sm leading-5">
                  <Icon className="mx-auto mb-3 text-[#8d3b19]" size={20} strokeWidth={1.5} />
                  {item}
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-[#f4dfd0] px-7 py-5 text-center"><strong className="moony-serif block text-2xl">Gratuit</strong><span className="text-sm">Pour toutes les utilisatrices</span></div>
          </div>
        </div>
      </section>

      <section id="professionnels" className="mx-auto max-w-[1500px] scroll-mt-24 px-6 py-14 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.25em] text-[#a15837]">MOONY Pro</p>
            <h2 className="moony-serif mt-2 text-4xl">Pour les professionnels de santé</h2>
            <p className="mt-1 text-[#5b2f22]/70">Des abonnements flexibles pour développer votre activité et mieux accompagner vos patientes.</p>
          </div>
          <p className="rounded-full bg-[#f1dfd2] px-4 py-2 text-xs text-[#6d3a2b]">Téléconsultations : commission MOONY de 3%</p>
        </div>

        <div className="mt-7 grid gap-5 xl:grid-cols-4">
          {plans.map((plan) => (
            <article key={plan.name} className={`relative rounded-[22px] border bg-white/72 p-7 ${plan.featured ? "border-[#d97b50] shadow-[0_18px_45px_rgba(112,50,27,.09)]" : "border-[#5b2f22]/12"}`}>
              {plan.featured ? <span className="absolute -top-3 right-5 rounded-full bg-[#7e3518] px-4 py-1 text-xs text-white">Le plus choisi</span> : null}
              <h3 className="text-sm font-semibold">Abonnement {plan.name.toLowerCase()}</h3>
              <p className="moony-serif mt-3 text-[30px]">{plan.price} <span className="font-sans text-sm text-[#5b2f22]/60">{plan.unit}</span></p>
              <ul className="mt-5 space-y-2 text-sm text-[#5b2f22]/75">
                {benefits.map((benefit) => <li key={benefit} className="flex gap-2"><Check className="mt-[2px] shrink-0 text-[#a45332]" size={15} /> <span>{benefit}</span></li>)}
              </ul>
              <Link href="/contact?objet=professionnel" className={`mt-7 block w-full rounded-full border px-5 py-3 text-center text-sm font-medium ${plan.featured ? "border-[#7e3518] bg-[#7e3518] text-white" : "border-[#5b2f22]/55"}`}>Choisir cette offre</Link>
            </article>
          ))}
        </div>
      </section>

      <section id="entreprises" className="scroll-mt-24 border-t border-[#5b2f22]/10 bg-white/48">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-6 py-12 lg:grid-cols-[.9fr_1fr_auto] lg:items-center lg:px-12">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.25em] text-[#a15837]">MOONY Entreprise</p>
            <h2 className="moony-serif mt-2 text-4xl">Pour les entreprises</h2>
            <p className="mt-2 text-[#5b2f22]/70">Une offre sur mesure pour soutenir la santé et le bien-être de vos collaboratrices.</p>
          </div>
          <div className="rounded-[22px] border border-[#5b2f22]/9 bg-[#f8eee7] p-6 text-sm leading-7">
            <div className="flex items-start gap-3"><Building2 className="mt-1 shrink-0 text-[#8d3b19]" size={22} strokeWidth={1.5} /><div><strong>Tarification sur mesure selon la taille de l’entreprise.</strong><br /><span className="text-[#5b2f22]/66">Accès aux services pour les collaboratrices · interface RH dédiée · gestion des licences · contenus santé & prévention · accompagnement personnalisé.</span></div></div>
          </div>
          <div className="flex flex-col gap-3"><Link href="/contact?objet=entreprise" className="rounded-full bg-[#7e3518] px-8 py-3 text-center text-sm font-medium text-white">Nous contacter</Link><Link href="/contact?objet=rappel" className="rounded-full border border-[#5b2f22]/55 px-8 py-3 text-center text-sm font-medium">Se faire rappeler</Link></div>
        </div>
      </section>

      <section className="bg-[#6b311d] text-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div><p className="moony-serif text-3xl">Besoin de plus d’informations ?</p><p className="mt-1 text-sm text-white/68">Notre équipe peut vous présenter l’offre la plus adaptée.</p></div>
          <a href={`mailto:${siteConfig.supportEmail}`} className="rounded-full border border-white/35 px-7 py-3 text-center text-sm font-medium hover:bg-white/8">Contacter un conseiller</a>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
