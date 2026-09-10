import Link from "next/link";
import { Droplets, Leaf, Recycle, Sparkles } from "lucide-react";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

const benefits = [
  ["Réutilisable", "Pensée pour réduire le recours au jetable et prolonger la durée d’usage.", Recycle],
  ["Confort", "Des produits conçus pour accompagner les journées de règles avec plus de sérénité.", Sparkles],
  ["Entretien simple", "Des conseils d’entretien clairs pour faciliter l’usage au quotidien.", Droplets],
  ["Impact durable", "Une démarche cohérente avec l’autonomie menstruelle et le développement durable.", Leaf],
] as const;

export default function ReusableProtectionPage() {
  return (
    <main className="min-h-screen bg-[#fffaf4] text-[#4d281d]">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_78%_35%,rgba(235,180,142,.38),transparent_30%),linear-gradient(110deg,#fff8f0_0%,#e6b58f_100%)] pt-36">
        <PublicHeader active="" />
        <div className="mx-auto grid max-w-[1500px] gap-10 px-6 pb-16 lg:grid-cols-[1fr_.9fr] lg:items-center lg:px-12 lg:pb-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.3em] text-[#9d4c27]">MOONY Réutilisable</p>
            <h1 className="moony-serif mt-4 max-w-[760px] text-[56px] leading-[.96] tracking-[-.045em] sm:text-[68px]">Des protections pensées pour durer.</h1>
            <p className="mt-6 max-w-[650px] text-[17px] leading-7 text-[#5b2f22]/72">MOONY prolonge sa mission au-delà du numérique avec des protections menstruelles réutilisables pensées pour conjuguer autonomie, confort et impact environnemental.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/contact?objet=protections" className="rounded-full bg-[#7e3518] px-7 py-3.5 text-sm font-medium text-white">Nous contacter</Link><Link href="/notre-mission" className="rounded-full border border-[#5b2f22]/40 px-7 py-3.5 text-sm font-medium">Découvrir notre mission</Link></div>
          </div>
          <div className="rounded-[34px] border border-[#5b2f22]/10 bg-[#b9693d] p-8 shadow-[0_24px_70px_rgba(83,43,28,.12)]"><div className="grid min-h-[380px] place-items-center rounded-[26px] border border-white/15 bg-[radial-gradient(circle_at_50%_20%,rgba(255,231,211,.3),transparent_34%),linear-gradient(145deg,#a95531,#ca8158)] text-center text-white"><div><div className="mx-auto grid h-28 w-28 place-items-center rounded-full border border-white/24 bg-white/10"><Leaf size={48} strokeWidth={1.1} /></div><p className="moony-serif mt-6 text-4xl">MOONY Africa</p><p className="mt-2 text-xs uppercase tracking-[.28em] text-white/60">Santé menstruelle durable</p></div></div></div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-6 py-16 lg:px-12 lg:py-20">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {benefits.map(([title, text, Icon]) => <article key={title} className="rounded-[24px] border border-[#5b2f22]/10 bg-white p-7"><div className="grid h-11 w-11 place-items-center rounded-full bg-[#f1d9c8] text-[#8d3b19]"><Icon size={20} strokeWidth={1.5} /></div><h2 className="moony-serif mt-5 text-3xl">{title}</h2><p className="mt-3 text-sm leading-6 text-[#5b2f22]/66">{text}</p></article>)}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
