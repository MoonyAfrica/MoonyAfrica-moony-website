import Link from "next/link";
import { PublicHeader } from "@/components/public-header";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#9c5f3f]">
      <section className="hero-photo hero-home moony-grain relative min-h-[760px] overflow-hidden lg:min-h-screen">
        <PublicHeader active="Accueil" light />

        <div className="relative z-10 mx-auto flex min-h-[760px] max-w-[1660px] items-center px-5 pb-14 pt-36 sm:px-8 lg:min-h-screen lg:px-12">
          <div className="max-w-[600px] text-[#fff9f3]">
            <h1 className="moony-serif text-[58px] leading-[.95] tracking-[-0.048em] sm:text-[72px] lg:text-[82px] xl:text-[88px]">
              Ancrée dans
              <br />nos cultures,
              <br />tournée vers
              <br />l’avenir.
            </h1>

            <p className="mt-7 max-w-[470px] text-[17px] leading-[1.55] text-white/92 sm:text-[18px]">
              Une expérience de santé féminine qui réunit transmission, communauté, bien-être et innovation à chaque étape de la vie.
            </p>

            <div className="mt-9 flex flex-wrap gap-3 sm:gap-4">
              <Link
                href="/communaute"
                className="rounded-full border border-[#e6a174]/75 bg-[#813617] px-7 py-3.5 text-[14px] font-medium text-white shadow-[0_12px_35px_rgba(49,20,12,.12)] transition hover:-translate-y-[1px]"
              >
                Découvrir la communauté
              </Link>
              <Link
                href="/services"
                className="rounded-full border border-white/75 bg-[#3b1d15]/10 px-7 py-3.5 text-[14px] font-medium text-white backdrop-blur-[2px] transition hover:bg-white/10"
              >
                Nos services
              </Link>
            </div>

            <div className="mt-14 flex items-center gap-4 text-[10px] font-medium uppercase tracking-[.27em] text-white/68">
              <span className="h-px w-10 bg-white/55" />
              <span>Santé</span>
              <span>•</span>
              <span>Sororité</span>
              <span>•</span>
              <span>Avenir</span>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[3] h-24 bg-gradient-to-t from-[#4a2116]/18 to-transparent" />
      </section>
    </main>
  );
}
