import Link from "next/link";
import { PublicHeader } from "@/components/public-header";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#c8845b]">
      <section className="hero-photo hero-home moony-grain relative min-h-screen overflow-hidden">
        <PublicHeader active="Accueil" light />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-[1560px] items-center px-6 pb-14 pt-36 lg:px-12">
          <div className="max-w-[620px] text-white">
            <h1 className="moony-serif text-[58px] leading-[.96] tracking-[-0.045em] sm:text-[72px] lg:text-[82px]">
              Ancrée dans
              <br />nos cultures,
              <br />tournée vers
              <br />l’avenir.
            </h1>
            <p className="mt-7 max-w-[440px] text-[18px] leading-7 text-white/92">
              Une expérience de santé féminine qui réunit transmission, communauté, bien-être et innovation à chaque étape de la vie.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/communaute" className="rounded-full border border-[#e8a06f] bg-[#8d3b19] px-8 py-4 text-[15px] font-medium text-white">
                Découvrir la communauté
              </Link>
              <Link href="/services" className="rounded-full border border-white/80 px-8 py-4 text-[15px] font-medium text-white backdrop-blur-sm">
                Nos services
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
